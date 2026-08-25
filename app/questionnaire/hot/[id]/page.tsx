'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, Lock, Download, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface QuestionnaireData {
    id: string;
    course_participant_id: string;
    status: string;
    submitted_at: string | null;
    average_score: number | null;
    additional_comments: string | null;
    course_participant: {
        id: string;
        course_id: string;
        course: {
            name: string;
            start_date: string | null;
            duration_hours: number;
        };
        employee: {
            nombre: string;
            employee_number: string;
            puesto: string;
            area: string;
        };
    };
}

interface Response {
    id: string;
    question_key: string;
    question_text: string;
    response_type: string;
    percentage_value: number | null;
    yes_no_value: boolean | null;
    text_value: string | null;
    section: string;
}

interface Signature {
    id: string;
    questionnaire_id: string;
    signer_type: 'employee' | 'evaluator';
    signer_name: string;
    signed_at: string;
}

const PERCENTAGE_OPTIONS = [
    { label: 'Bajo (40%)', value: 40 },
    { label: 'Suficiente (60%)', value: 60 },
    { label: 'Bien (80%)', value: 80 },
    { label: 'Excelente (100%)', value: 100 },
];

export default function HotQuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
    const [responses, setResponses] = useState<Response[]>([]);
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [additionalComments, setAdditionalComments] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showProblemsDetail, setShowProblemsDetail] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    useEffect(() => {
        fetchQuestionnaire();
    }, [resolvedParams.id]);

    const fetchQuestionnaire = async () => {
        try {
            const res = await fetch(`/questionnaire/hot/${resolvedParams.id}/data`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Cuestionario no encontrado');
            }

            const { questionnaire: qData, responses: rData, signatures: sData } = await res.json();

            setQuestionnaire(qData);
            setResponses(rData);
            setSignatures(sData);
            setAdditionalComments(qData.additional_comments || '');

            const hasProblems = (rData as Response[]).find(r => r.question_key === 'has_problems');
            if (hasProblems?.yes_no_value === true) {
                setShowProblemsDetail(true);
            }
        } catch (error: any) {
            console.error('Error fetching questionnaire:', error);
            toast.error(error?.message || 'Error al cargar el cuestionario');
        } finally {
            setLoading(false);
        }
    };

    const updateResponse = async (questionKey: string, value: any, type: 'percentage' | 'yes_no' | 'text') => {
        if (questionnaire?.submitted_at !== null) return;

        try {
            const res = await fetch(`/questionnaire/hot/${resolvedParams.id}/data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_response',
                    question_key: questionKey,
                    value,
                    response_type: type,
                }),
            });

            if (!res.ok) {
                toast.error('Error al guardar la respuesta');
                return;
            }

            if (type === 'yes_no' && questionKey === 'has_problems') {
                setShowProblemsDetail(value === true);
            }

            setResponses(prev =>
                prev.map(r => {
                    if (r.question_key === questionKey) {
                        if (type === 'percentage') return { ...r, percentage_value: value };
                        if (type === 'yes_no') return { ...r, yes_no_value: value };
                        if (type === 'text') return { ...r, text_value: value };
                    }
                    if (type === 'yes_no' && questionKey === 'has_problems' && value === false && r.question_key === 'problems_detail') {
                        return { ...r, text_value: null };
                    }
                    return r;
                })
            );
        } catch (error) {
            console.error('Error updating response:', error);
            toast.error('Error al guardar la respuesta');
        }
    };

    const validateForm = () => {
        const evaluationResponses = responses.filter(r => r.section === 'evaluation');
        const allEvaluationAnswered = evaluationResponses.every(r => r.percentage_value !== null);

        if (!allEvaluationAnswered) {
            toast.error('Por favor responda todas las preguntas de evaluación');
            return false;
        }

        const feedbackResponses = responses.filter(r => r.section === 'feedback' && r.response_type === 'yes_no');
        const allFeedbackAnswered = feedbackResponses.every(r => r.yes_no_value !== null);

        if (!allFeedbackAnswered) {
            toast.error('Por favor responda todas las preguntas de retroalimentación');
            return false;
        }

        const hasProblems = responses.find(r => r.question_key === 'has_problems');
        const problemsDetail = responses.find(r => r.question_key === 'problems_detail');

        if (hasProblems?.yes_no_value === true && !problemsDetail?.text_value?.trim()) {
            toast.error('Por favor especifique el problema que debe abordarse');
            return false;
        }

        return true;
    };

    const validateEmployeeForm = () => {
        if (!employeeName.trim()) {
            toast.error('Por favor ingrese su nombre para firmar');
            return false;
        }
        return true;
    };

    const handleEmployeeSign = async () => {
        if (!validateForm() || !validateEmployeeForm()) return;

        setSaving(true);
        try {
            const evaluationResponses = responses.filter(
                r => r.section === 'evaluation' && r.percentage_value !== null
            );
            const average = evaluationResponses.reduce((sum, r) => sum + (r.percentage_value || 0), 0) / evaluationResponses.length;

            const res = await fetch(`/questionnaire/hot/${resolvedParams.id}/data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sign_employee',
                    signer_name: employeeName.trim(),
                    average_score: average,
                    additional_comments: additionalComments || null,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al enviar la firma');
            }

            toast.success('Cuestionario firmado y enviado exitosamente');

            setTimeout(() => {
                router.push(`/course/${questionnaire?.course_participant.course_id}`);
            }, 1500);
        } catch (error: any) {
            console.error('Error submitting questionnaire:', error);
            toast.error(error?.message || 'Error al enviar el cuestionario');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!questionnaire?.submitted_at) {
            toast.error('El cuestionario debe estar completado para descargar el PDF');
            return;
        }

        setDownloadingPDF(true);
        try {
            const response = await fetch(`/api/questionnaire-pdf/${resolvedParams.id}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al generar el PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Cuestionario_${questionnaire.course_participant.employee.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('PDF descargado exitosamente');
        } catch (error: any) {
            console.error('Error downloading PDF:', error);
            toast.error(error.message || 'Error al descargar el PDF');
        } finally {
            setDownloadingPDF(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-gray-500">Cargando cuestionario...</div>
            </div>
        );
    }

    if (!questionnaire) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Cuestionario no encontrado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.back()}>Volver</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isLocked = questionnaire.submitted_at !== null;
    const evaluationQuestions = responses.filter(r => r.section === 'evaluation');
    const feedbackQuestions = responses.filter(r => r.section === 'feedback');
    const employeeSignature = signatures.find(s => s.signer_type === 'employee');

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => router.push(`/course/${questionnaire.course_participant.course_id}`)}
                    className="mb-6"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al curso
                </Button>

                {/* Info Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl mb-2">Cuestionario del Empleado</CardTitle>
                                <CardDescription>
                                    Cuestionario de satisfacción del participante sobre la capacitación recibida
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => {
                                        const url = `${window.location.origin}/public/questionnaire/${questionnaire.id}`;
                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(url).then(() => {
                                                toast.success('Enlace copiado al portapapeles');
                                            }).catch(() => {
                                                toast.error('No se pudo copiar el enlace');
                                            });
                                        } else {
                                            const ta = document.createElement('textarea');
                                            ta.value = url;
                                            ta.style.position = 'fixed';
                                            ta.style.opacity = '0';
                                            document.body.appendChild(ta);
                                            ta.focus();
                                            ta.select();
                                            try {
                                                document.execCommand('copy');
                                                toast.success('Enlace copiado al portapapeles');
                                            } catch {
                                                toast.error('No se pudo copiar el enlace');
                                            }
                                            document.body.removeChild(ta);
                                        }
                                    }}
                                    variant="outline"
                                    size="sm"
                                    title="Copiar enlace público"
                                >
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    Compartir
                                </Button>
                                {isLocked && (
                                    <>
                                        <Button
                                            onClick={handleDownloadPDF}
                                            disabled={downloadingPDF}
                                            variant="outline"
                                            size="sm"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            {downloadingPDF ? 'Generando...' : 'Descargar PDF'}
                                        </Button>
                                        <Lock className="h-6 w-6 text-gray-400" />
                                    </>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-semibold text-gray-700">Nombre del curso</p>
                                <p className="text-gray-600">{questionnaire.course_participant.course.name}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Participante</p>
                                <p className="text-gray-600">{questionnaire.course_participant.employee.nombre}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Puesto</p>
                                <p className="text-gray-600">{questionnaire.course_participant.employee.puesto}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Área</p>
                                <p className="text-gray-600">{questionnaire.course_participant.employee.area}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Fecha del curso</p>
                                <p className="text-gray-600">
                                    {questionnaire.course_participant.course.start_date
                                        ? format(new Date(questionnaire.course_participant.course.start_date + 'T12:00:00'), 'dd/MM/yyyy')
                                        : format(new Date(), 'dd/MM/yyyy')}
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Número de empleado</p>
                                <p className="text-gray-600">{questionnaire.course_participant.employee.employee_number}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Duración del curso</p>
                                <p className="text-gray-600">{questionnaire.course_participant.course.duration_hours} horas</p>
                            </div>
                            {isLocked && questionnaire.average_score !== null && (
                                <div>
                                    <p className="font-semibold text-gray-700">Promedio</p>
                                    <p className="text-gray-600">{questionnaire.average_score.toFixed(2)}%</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Sección 1 - Evaluación Porcentual</CardTitle>
                        <CardDescription>Todas las preguntas son obligatorias</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {evaluationQuestions.map((q) => (
                            <div key={q.id} className="space-y-3">
                                <Label className="text-base font-semibold">{q.question_text}</Label>
                                <RadioGroup
                                    disabled={isLocked}
                                    value={q.percentage_value?.toString() || ''}
                                    onValueChange={(val) => updateResponse(q.question_key, parseInt(val), 'percentage')}
                                >
                                    {PERCENTAGE_OPTIONS.map(opt => (
                                        <div key={opt.value} className="flex items-center space-x-2">
                                            <RadioGroupItem value={opt.value.toString()} id={`${q.id}-${opt.value}`} />
                                            <Label
                                                htmlFor={`${q.id}-${opt.value}`}
                                                className="font-normal cursor-pointer"
                                            >
                                                {opt.label}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Sección 2 - Retroalimentación */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Sección 2 - Retroalimentación</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {feedbackQuestions.map((q) => {
                            if (q.response_type === 'yes_no') {
                                return (
                                    <div key={q.id} className="space-y-3">
                                        <Label className="text-base font-semibold">{q.question_text}</Label>
                                        <RadioGroup
                                            disabled={isLocked}
                                            value={q.yes_no_value === null ? '' : q.yes_no_value ? 'true' : 'false'}
                                            onValueChange={(val) => updateResponse(q.question_key, val === 'true', 'yes_no')}
                                            className="flex gap-4"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="true" id={`${q.id}-yes`} />
                                                <Label htmlFor={`${q.id}-yes`} className="font-normal cursor-pointer">Sí</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="false" id={`${q.id}-no`} />
                                                <Label htmlFor={`${q.id}-no`} className="font-normal cursor-pointer">No</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                );
                            }

                            if (q.question_key === 'problems_detail' && !showProblemsDetail) {
                                return null;
                            }

                            return (
                                <div key={q.id} className="space-y-3">
                                    <Label className="text-base font-semibold">{q.question_text}</Label>
                                    <Textarea
                                        disabled={isLocked}
                                        value={q.text_value || ''}
                                        onChange={(e) => updateResponse(q.question_key, e.target.value, 'text')}
                                        placeholder="Escriba sus comentarios aquí..."
                                        rows={3}
                                    />
                                </div>
                            );
                        })}

                        {/* Comentarios adicionales */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Comentarios adicionales</Label>
                            <Textarea
                                disabled={isLocked}
                                value={additionalComments}
                                onChange={(e) => setAdditionalComments(e.target.value)}
                                placeholder="Escriba sus comentarios adicionales aquí..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Firmas registradas */}
                {signatures.length > 0 && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Firmas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {employeeSignature && (
                                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-green-900">Participante</p>
                                        <p className="text-green-700">{employeeSignature.signer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-green-600">
                                            <CheckCircle2 className="inline h-4 w-4 mr-1" />
                                            {format(new Date(employeeSignature.signed_at), 'dd/MM/yyyy HH:mm')} hrs
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Firma del participante */}
                {!isLocked && !employeeSignature && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Firmado por:</CardTitle>
                            <CardDescription>
                                Una vez firmado, no podrá modificar las respuestas
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="employee-name">Nombre del Participante</Label>
                                <Input
                                    id="employee-name"
                                    value={employeeName}
                                    onChange={(e) => setEmployeeName(e.target.value)}
                                    placeholder="Ingrese su nombre completo"
                                />
                            </div>
                            <Button
                                onClick={handleEmployeeSign}
                                disabled={saving}
                                className="w-full"
                            >
                                {saving ? 'Firmando...' : 'Firmar Cuestionario'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

            </div>
        </div>
    );
}

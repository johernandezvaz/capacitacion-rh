'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, Lock, PenTool, Download } from 'lucide-react';
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

                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl">
                                    EVALUACIÓN DE REACCIÓN (REACCIÓN INMEDIATA / CALIENTE)
                                </CardTitle>
                                <CardDescription className="mt-2">
                                    Cuestionario de satisfacción del participante sobre la capacitación recibida
                                </CardDescription>
                            </div>
                            {isLocked && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={handleDownloadPDF}
                                        disabled={downloadingPDF}
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        {downloadingPDF ? 'Descargando...' : 'Descargar PDF'}
                                    </Button>
                                    <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
                                        <Lock className="w-4 h-4 mr-1" />
                                        <span className="text-xs font-medium">Completado y bloqueado</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg">
                            <div>
                                <span className="font-semibold text-gray-700">Nombre del Participante:</span>{' '}
                                {questionnaire.course_participant.employee.nombre}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Número de Empleado:</span>{' '}
                                {questionnaire.course_participant.employee.employee_number}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Puesto:</span>{' '}
                                {questionnaire.course_participant.employee.puesto}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Área:</span>{' '}
                                {questionnaire.course_participant.employee.area}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Nombre del Curso:</span>{' '}
                                {questionnaire.course_participant.course.name}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Fecha de Inicio:</span>{' '}
                                {questionnaire.course_participant.course.start_date
                                    ? format(new Date(questionnaire.course_participant.course.start_date), 'dd/MM/yyyy')
                                    : 'N/A'}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Duración:</span>{' '}
                                {questionnaire.course_participant.course.duration_hours} hrs
                            </div>
                            {questionnaire.average_score !== null && (
                                <div>
                                    <span className="font-semibold text-gray-700">Promedio General:</span>{' '}
                                    <span className="font-bold text-blue-600">
                                        {questionnaire.average_score.toFixed(1)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-xl">I. EVALUACIÓN DE LA CAPACITACIÓN</CardTitle>
                        <CardDescription>
                            Seleccione el nivel de satisfacción para cada uno de los siguientes aspectos
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {evaluationQuestions.map((q, idx) => (
                            <div key={q.id} className="border-b pb-4 last:border-0">
                                <Label className="text-base font-medium mb-3 block">
                                    {idx + 1}. {q.question_text}
                                </Label>
                                <RadioGroup
                                    disabled={isLocked}
                                    value={q.percentage_value?.toString() || ''}
                                    onValueChange={(val) => updateResponse(q.question_key, parseInt(val), 'percentage')}
                                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2"
                                >
                                    {PERCENTAGE_OPTIONS.map(opt => (
                                        <div key={opt.value} className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                                            <RadioGroupItem value={opt.value.toString()} id={`${q.id}-${opt.value}`} />
                                            <Label htmlFor={`${q.id}-${opt.value}`} className="cursor-pointer font-normal text-sm">
                                                {opt.label}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-xl">II. RETROALIMENTACIÓN</CardTitle>
                        <CardDescription>
                            Responda a las siguientes preguntas sobre la utilidad de la capacitación
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {feedbackQuestions.map((q) => {
                            if (q.response_type === 'yes_no') {
                                return (
                                    <div key={q.id} className="border-b pb-4 last:border-0">
                                        <Label className="text-base font-medium mb-3 block">
                                            {q.question_text}
                                        </Label>
                                        <RadioGroup
                                            disabled={isLocked}
                                            value={q.yes_no_value === null ? '' : q.yes_no_value ? 'true' : 'false'}
                                            onValueChange={(val) => updateResponse(q.question_key, val === 'true', 'yes_no')}
                                            className="flex space-x-6 mt-2"
                                        >
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 w-32 hover:bg-slate-50">
                                                <RadioGroupItem value="true" id={`${q.id}-yes`} />
                                                <Label htmlFor={`${q.id}-yes`} className="cursor-pointer font-normal">Sí</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 w-32 hover:bg-slate-50">
                                                <RadioGroupItem value="false" id={`${q.id}-no`} />
                                                <Label htmlFor={`${q.id}-no`} className="cursor-pointer font-normal">No</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                );
                            }

                            if (q.question_key === 'problems_detail' && !showProblemsDetail) {
                                return null;
                            }

                            return (
                                <div key={q.id} className="border-b pb-4 last:border-0">
                                    <Label className="text-base font-medium mb-2 block">
                                        {q.question_text}
                                    </Label>
                                    <Textarea
                                        disabled={isLocked}
                                        value={q.text_value || ''}
                                        onChange={(e) => updateResponse(q.question_key, e.target.value, 'text')}
                                        placeholder="Escriba sus comentarios aquí..."
                                        rows={3}
                                        className="mt-2"
                                    />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-xl">III. COMENTARIOS ADICIONALES</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            disabled={isLocked}
                            value={additionalComments}
                            onChange={(e) => setAdditionalComments(e.target.value)}
                            placeholder="Comentarios adicionales sobre el curso..."
                            rows={3}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <PenTool className="w-5 h-5" />
                            IV. FIRMA DEL PARTICIPANTE
                        </CardTitle>
                        <CardDescription>
                            {isLocked
                                ? 'El cuestionario ha sido firmado y enviado'
                                : 'Ingrese su nombre completo para firmar electrónicamente este cuestionario'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {employeeSignature ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    <div>
                                        <div className="font-semibold text-green-900">
                                            Firmado por: {employeeSignature.signer_name}
                                        </div>
                                        <div className="text-xs text-green-700">
                                            Fecha: {format(new Date(employeeSignature.signed_at), 'dd/MM/yyyy HH:mm')} hrs
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="employeeName">Nombre Completo del Participante *</Label>
                                    <Input
                                        id="employeeName"
                                        value={employeeName}
                                        onChange={(e) => setEmployeeName(e.target.value)}
                                        placeholder="Ingrese su nombre completo tal como aparece en el registro"
                                        className="mt-1"
                                    />
                                </div>
                                <Button
                                    onClick={handleEmployeeSign}
                                    disabled={saving}
                                    className="w-full bg-[#2166be] hover:bg-[#1a5299]"
                                    size="lg"
                                >
                                    {saving ? 'Guardando y Firmando...' : 'Firmar y Enviar Cuestionario'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

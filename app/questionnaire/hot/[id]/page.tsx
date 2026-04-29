'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, Lock, PenTool, Download, Link as LinkIcon } from 'lucide-react';
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
            const { data: qData, error: qError } = await supabase
                .from('questionnaires')
                .select(`
          id,
          course_participant_id,
          status,
          submitted_at,
          average_score,
          additional_comments,
          course_participant:course_participants(
            id,
            course_id,
            course:courses(name, start_date, duration_hours),
            employee:employees(nombre, employee_number, puesto, area)
          )
        `)
                .eq('id', resolvedParams.id)
                .eq('type', 'hot')
                .maybeSingle();

            if (qError) throw qError;
            if (!qData) {
                throw new Error('Cuestionario no encontrado');
            }

            const { data: rData, error: rError } = await supabase
                .from('questionnaire_responses')
                .select('*')
                .eq('questionnaire_id', resolvedParams.id)
                .order('question_key');

            if (rError) throw rError;

            const { data: sData, error: sError } = await supabase
                .from('questionnaire_signatures')
                .select('*')
                .eq('questionnaire_id', resolvedParams.id)
                .order('signed_at');

            if (sError) throw sError;

            setQuestionnaire(qData as any);
            setResponses(rData as Response[]);
            setSignatures(sData as Signature[]);
            setAdditionalComments(qData.additional_comments || '');

            const hasProblems = rData.find(r => r.question_key === 'has_problems');
            if (hasProblems?.yes_no_value === true) {
                setShowProblemsDetail(true);
            }
        } catch (error: any) {
            console.error('Error fetching questionnaire:', error);
            toast.error('Error al cargar el cuestionario');
        } finally {
            setLoading(false);
        }
    };

    const updateResponse = async (questionKey: string, value: any, type: 'percentage' | 'yes_no' | 'text') => {
        if (questionnaire?.submitted_at !== null) return;

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (type === 'percentage') {
            updateData.percentage_value = value;
        } else if (type === 'yes_no') {
            updateData.yes_no_value = value;

            if (questionKey === 'has_problems') {
                setShowProblemsDetail(value === true);
                if (value === false) {
                    await supabase
                        .from('questionnaire_responses')
                        .update({ text_value: null })
                        .eq('questionnaire_id', resolvedParams.id)
                        .eq('question_key', 'problems_detail');
                }
            }
        } else if (type === 'text') {
            updateData.text_value = value;
        }

        const { error } = await supabase
            .from('questionnaire_responses')
            .update(updateData)
            .eq('questionnaire_id', resolvedParams.id)
            .eq('question_key', questionKey);

        if (error) {
            console.error('Error updating response:', error);
            toast.error('Error al guardar la respuesta');
            return;
        }

        setResponses(prev =>
            prev.map(r =>
                r.question_key === questionKey
                    ? { ...r, ...updateData }
                    : r
            )
        );
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

            const { error: sigError } = await supabase
                .from('questionnaire_signatures')
                .insert({
                    questionnaire_id: resolvedParams.id,
                    signer_type: 'employee',
                    signer_name: employeeName.trim(),
                });

            if (sigError) throw sigError;

            const { error } = await supabase
                .from('questionnaires')
                .update({
                    status: 'completed',
                    submitted_at: new Date().toISOString(),
                    average_score: average,
                    additional_comments: additionalComments || null,
                })
                .eq('id', resolvedParams.id);

            if (error) throw error;

            toast.success('Cuestionario firmado y enviado exitosamente');

            setTimeout(() => {
                router.push(`/course/${questionnaire?.course_participant.course_id}`);
            }, 1500);
        } catch (error: any) {
            console.error('Error submitting questionnaire:', error);
            toast.error('Error al enviar el cuestionario');
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
                                <CardTitle className="text-2xl mb-2">Cuestionario del Empleado</CardTitle>
                                <CardDescription>
                                    {'Cuestionario completado'}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => {
                                        const url = `${window.location.origin}/public/questionnaire/${questionnaire.id}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success('Enlace copiado al portapapeles');
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
                                <p className="font-semibold text-gray-700">Empleado</p>
                                <p className="text-gray-600">{questionnaire.course_participant.employee.nombre}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Puesto del empleado</p>
                                <p className="text-gray-600">{questionnaire.course_participant.employee.puesto}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Área del empleado</p>
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
                            {isLocked && questionnaire.average_score && (
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
                        <CardDescription>
                            Todas las preguntas son obligatorias
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {evaluationQuestions.map((question) => (
                            <div key={question.id} className="space-y-3">
                                <Label className="text-base font-semibold">{question.question_text}</Label>
                                <RadioGroup
                                    value={question.percentage_value?.toString() || ''}
                                    onValueChange={(value) => updateResponse(question.question_key, parseInt(value), 'percentage')}
                                    disabled={isLocked}
                                    className="flex flex-col space-y-2"
                                >
                                    {PERCENTAGE_OPTIONS.map((option) => (
                                        <div key={option.value} className="flex items-center space-x-2">
                                            <RadioGroupItem value={option.value.toString()} id={`${question.id}-${option.value}`} />
                                            <Label
                                                htmlFor={`${question.id}-${option.value}`}
                                                className="font-normal cursor-pointer"
                                            >
                                                {option.label}
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
                        <CardTitle>Sección 2 - Retroalimentación</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {feedbackQuestions.map((question) => {
                            if (question.response_type === 'yes_no') {
                                const isProblemsQuestion = question.question_key === 'has_problems';
                                const problemsDetailQuestion = feedbackQuestions.find(q => q.question_key === 'problems_detail');

                                return (
                                    <div key={question.id} className="space-y-3">
                                        <Label className="text-base font-semibold">{question.question_text}</Label>
                                        <RadioGroup
                                            value={question.yes_no_value === null ? '' : question.yes_no_value.toString()}
                                            onValueChange={(value) => updateResponse(question.question_key, value === 'true', 'yes_no')}
                                            disabled={isLocked}
                                            className="flex gap-6"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="true" id={`${question.id}-yes`} />
                                                <Label htmlFor={`${question.id}-yes`} className="font-normal cursor-pointer">
                                                    Sí
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="false" id={`${question.id}-no`} />
                                                <Label htmlFor={`${question.id}-no`} className="font-normal cursor-pointer">
                                                    No
                                                </Label>
                                            </div>
                                        </RadioGroup>

                                        {isProblemsQuestion && showProblemsDetail && problemsDetailQuestion && (
                                            <div className="mt-4 ml-6 space-y-2">
                                                <Label className="text-base font-semibold">{problemsDetailQuestion.question_text}</Label>
                                                <Textarea
                                                    value={problemsDetailQuestion.text_value || ''}
                                                    onChange={(e) => updateResponse(problemsDetailQuestion.question_key, e.target.value, 'text')}
                                                    disabled={isLocked}
                                                    placeholder="Especifique el problema..."
                                                    rows={3}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return null;
                        })}

                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Comentarios adicionales</Label>
                            <Textarea
                                value={additionalComments}
                                onChange={(e) => setAdditionalComments(e.target.value)}
                                disabled={isLocked}
                                placeholder="Comentarios opcionales..."
                                rows={4}
                            />
                        </div>
                    </CardContent>
                </Card>

                {!isLocked && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PenTool className="h-5 w-5" />
                                Firma del Empleado
                            </CardTitle>
                            <CardDescription>
                                Para completar el cuestionario, por favor ingrese su nombre como firma
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="employee-name">Nombre del empleado *</Label>
                                <Input
                                    id="employee-name"
                                    value={employeeName}
                                    onChange={(e) => setEmployeeName(e.target.value)}
                                    placeholder="Escriba su nombre completo"
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleEmployeeSign}
                                    disabled={saving}
                                    size="lg"
                                    className="min-w-[200px]"
                                >
                                    {saving ? 'Enviando...' : 'Firmar y Enviar'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isLocked && employeeSignature && (
                    <Card className="mb-6 border-green-200 bg-green-50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-800">
                                <CheckCircle2 className="h-5 w-5" />
                                Cuestionario Completado
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-green-800">Firmado por:</span>
                                    <span className="text-green-700">{employeeSignature.signer_name}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, Lock, AlertCircle, Download } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { toast } from 'sonner';

interface QuestionnaireData {
    id: string;
    course_participant_id: string;
    status: string;
    submitted_at: string | null;
    available_from: string;
    average_score: number | null;
    observation_1: string | null;
    observation_2: string | null;
    observation_3: string | null;
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
    section: string;
}

interface Signature {
    id: string;
    signer_type: string;
    signer_name: string;
    signed_at: string;
}

const COLD_PERCENTAGE_OPTIONS = [
    { label: 'N/A', value: 0 },
    { label: '<25%', value: 25 },
    { label: '40%', value: 40 },
    { label: '60%', value: 60 },
    { label: '80%', value: 80 },
    { label: '100%', value: 100 },
];

export default function ColdQuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
    const [responses, setResponses] = useState<Response[]>([]);
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [observation1, setObservation1] = useState('');
    const [observation2, setObservation2] = useState('');
    const [observation3, setObservation3] = useState('');
    const [evaluatorName, setEvaluatorName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);

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
          available_from,
          average_score,
          observation_1,
          observation_2,
          observation_3,
          course_participant:course_participants(
            id,
            course_id,
            course:courses(name, start_date, duration_hours),
            employee:employees(nombre, employee_number, puesto, area)
          )
        `)
                .eq('id', resolvedParams.id)
                .eq('type', 'cold')
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
            setObservation1(qData.observation_1 || '');
            setObservation2(qData.observation_2 || '');
            setObservation3(qData.observation_3 || '');

            const now = new Date();
            const availableDate = qData.available_from ? new Date(qData.available_from) : null;
            setIsAvailable(availableDate ? isAfter(now, availableDate) : false);
        } catch (error: any) {
            console.error('Error fetching questionnaire:', error);
            toast.error('Error al cargar el cuestionario');
        } finally {
            setLoading(false);
        }
    };

    const updateResponse = async (questionKey: string, value: number) => {
        if (questionnaire?.submitted_at !== null || !isAvailable) return;

        const evaluatorSignature = signatures.find(s => s.signer_type === 'evaluator');
        if (evaluatorSignature) {
            toast.error('No se puede modificar después de firmar');
            return;
        }

        const { error } = await supabase
            .from('questionnaire_responses')
            .update({
                percentage_value: value,
                updated_at: new Date().toISOString(),
            })
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
                    ? { ...r, percentage_value: value }
                    : r
            )
        );
    };

    const updateObservations = async () => {
        const evaluatorSignature = signatures.find(s => s.signer_type === 'evaluator');
        if (evaluatorSignature) {
            return;
        }

        const { error } = await supabase
            .from('questionnaires')
            .update({
                observation_1: observation1,
                observation_2: observation2,
                observation_3: observation3,
            })
            .eq('id', resolvedParams.id);

        if (error) {
            console.error('Error updating observations:', error);
        }
    };

    const validateEvaluatorForm = () => {
        const allAnswered = responses.every(r => r.percentage_value !== null);

        if (!allAnswered) {
            toast.error('Por favor responda todas las preguntas de evaluación');
            return false;
        }

        const hasAtLeastOneObservation =
            observation1.trim() || observation2.trim() || observation3.trim();

        if (!hasAtLeastOneObservation) {
            toast.error(
                'Se requiere al menos una observación para poder firmar. Por favor llene al menos el campo de Observación 1.',
                { duration: 5000 }
            );
            return false;
        }

        if (!evaluatorName.trim()) {
            toast.error('Por favor ingrese el nombre del evaluador');
            return false;
        }

        return true;
    };

    const handleEvaluatorSign = async () => {
        if (!validateEvaluatorForm()) return;

        setSaving(true);
        try {
            const validResponses = responses.filter(r => r.percentage_value !== null && r.percentage_value > 0);
            const average = validResponses.length > 0
                ? validResponses.reduce((sum, r) => sum + (r.percentage_value || 0), 0) / validResponses.length
                : 0;

            const { error: qError } = await supabase
                .from('questionnaires')
                .update({
                    average_score: average,
                    observation_1: observation1.trim(),
                    observation_2: observation2.trim(),
                    observation_3: observation3.trim(),
                })
                .eq('id', resolvedParams.id);

            if (qError) throw qError;

            const { error: sigError } = await supabase
                .from('questionnaire_signatures')
                .insert({
                    questionnaire_id: resolvedParams.id,
                    signer_type: 'evaluator',
                    signer_name: evaluatorName.trim(),
                });

            if (sigError) throw sigError;

            toast.success('Firma del evaluador registrada exitosamente');
            await fetchQuestionnaire();
        } catch (error: any) {
            console.error('Error signing questionnaire:', error);
            toast.error('Error al registrar la firma');
        } finally {
            setSaving(false);
        }
    };

    const validateEmployeeForm = () => {
        if (!employeeName.trim()) {
            toast.error('Por favor ingrese el nombre del empleado');
            return false;
        }

        return true;
    };

    const handleEmployeeSign = async () => {
        if (!validateEmployeeForm()) return;

        setSaving(true);
        try {
            const { error: sigError } = await supabase
                .from('questionnaire_signatures')
                .insert({
                    questionnaire_id: resolvedParams.id,
                    signer_type: 'employee',
                    signer_name: employeeName.trim(),
                });

            if (sigError) throw sigError;

            const { error: qError } = await supabase
                .from('questionnaires')
                .update({
                    status: 'completed',
                    submitted_at: new Date().toISOString(),
                })
                .eq('id', resolvedParams.id);

            if (qError) throw qError;

            toast.success('Cuestionario completado exitosamente');

            setTimeout(() => {
                router.push(`/course/${questionnaire?.course_participant.course_id}`);
            }, 1500);
        } catch (error: any) {
            console.error('Error signing questionnaire:', error);
            toast.error('Error al registrar la firma');
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
    const evaluatorSignature = signatures.find(s => s.signer_type === 'evaluator');
    const employeeSignature = signatures.find(s => s.signer_type === 'employee');
    const canEdit = isAvailable && !evaluatorSignature && !isLocked;
    const canEmployeeSign = evaluatorSignature && !employeeSignature && !isLocked;

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
                                <CardTitle className="text-2xl mb-2">Cuestionario del Evaluador</CardTitle>
                                <CardDescription>
                                    {!isAvailable ? (
                                        <span className="flex items-center text-amber-600">
                                            <AlertCircle className="mr-2 h-4 w-4" />
                                            Este cuestionario estará disponible hasta el {questionnaire.available_from ? format(new Date(questionnaire.available_from), 'dd/MM/yyyy') : '—'}
                                        </span>
                                    ) : (
                                        'Cuestionario completado'
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
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
                                {!isLocked && !isAvailable && (
                                    <Lock className="h-6 w-6 text-gray-400" />
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
                        <CardTitle>Evaluación del Evaluador</CardTitle>
                        <CardDescription>
                            Complete todas las evaluaciones. Use N/A si no aplica.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {responses.map((question) => (
                            <div key={question.id} className="space-y-3">
                                <Label className="text-base font-semibold">{question.question_text}</Label>
                                <RadioGroup
                                    value={question.percentage_value?.toString() || ''}
                                    onValueChange={(value) => updateResponse(question.question_key, parseInt(value))}
                                    disabled={!canEdit}
                                    className="flex flex-wrap gap-4"
                                >
                                    {COLD_PERCENTAGE_OPTIONS.map((option) => (
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
                        <CardTitle>Observaciones del Evaluador</CardTitle>
                        <CardDescription>
                            Complete al menos una observación (obligatoria). Las demás son opcionales.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="obs1" className="text-base font-semibold">Observación 1 *</Label>
                            <Textarea
                                id="obs1"
                                value={observation1}
                                onChange={(e) => setObservation1(e.target.value)}
                                onBlur={updateObservations}
                                disabled={!canEdit}
                                placeholder="Ingrese la primera observación..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="obs2" className="text-base font-semibold">Observación 2 <span className="text-gray-400 font-normal text-sm">(opcional)</span></Label>
                            <Textarea
                                id="obs2"
                                value={observation2}
                                onChange={(e) => setObservation2(e.target.value)}
                                onBlur={updateObservations}
                                disabled={!canEdit}
                                placeholder="Ingrese la segunda observación (opcional)..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="obs3" className="text-base font-semibold">Observación 3 <span className="text-gray-400 font-normal text-sm">(opcional)</span></Label>
                            <Textarea
                                id="obs3"
                                value={observation3}
                                onChange={(e) => setObservation3(e.target.value)}
                                onBlur={updateObservations}
                                disabled={!canEdit}
                                placeholder="Ingrese la tercera observación (opcional)..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                {signatures.length > 0 && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Firmas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {evaluatorSignature && (
                                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-green-900">Evaluador</p>
                                        <p className="text-green-700">{evaluatorSignature.signer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-green-600">

                                        </p>
                                    </div>
                                </div>
                            )}
                            {employeeSignature && (
                                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-blue-900">Empleado</p>
                                        <p className="text-blue-700">{employeeSignature.signer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-blue-600">

                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {canEdit && !evaluatorSignature && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Firma del Evaluador</CardTitle>
                            <CardDescription>
                                Una vez firmado, no podrá modificar las respuestas
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="evaluator-name">Nombre del Evaluador</Label>
                                <Input
                                    id="evaluator-name"
                                    value={evaluatorName}
                                    onChange={(e) => setEvaluatorName(e.target.value)}
                                    placeholder="Ingrese su nombre completo"
                                />
                            </div>
                            <Button
                                onClick={handleEvaluatorSign}
                                disabled={saving}
                                className="w-full"
                            >
                                {saving ? 'Firmando...' : 'Firmar como Evaluador'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {canEmployeeSign && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Firma del Empleado</CardTitle>
                            <CardDescription>
                                Revise la evaluación y firme para completar el cuestionario
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="employee-name">Nombre del Empleado</Label>
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
                                {saving ? 'Firmando...' : 'Firmar como Empleado'}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

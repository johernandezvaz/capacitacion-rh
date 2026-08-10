'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
    const [evaluatorName, setEvaluatorName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);

    useEffect(() => {
        fetchQuestionnaire();
    }, [resolvedParams.id]);

    const fetchQuestionnaire = async () => {
        try {
            const res = await fetch(`/questionnaire/cold/${resolvedParams.id}/data`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Cuestionario no encontrado');
            }

            const { questionnaire: qData, responses: rData, signatures: sData } = await res.json();

            setQuestionnaire(qData);
            setResponses(rData);
            setSignatures(sData);
            setObservation1(qData.observation_1 || '');

            const now = new Date();
            const availableDate = qData.available_from ? new Date(qData.available_from) : null;
            setIsAvailable(availableDate ? isAfter(now, availableDate) : false);
        } catch (error: any) {
            console.error('Error fetching questionnaire:', error);
            toast.error(error?.message || 'Error al cargar el cuestionario');
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

        try {
            const res = await fetch(`/questionnaire/cold/${resolvedParams.id}/data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_response',
                    question_key: questionKey,
                    value,
                }),
            });

            if (!res.ok) {
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
        } catch (error) {
            console.error('Error updating response:', error);
            toast.error('Error al guardar la respuesta');
        }
    };

    const updateObservations = async () => {
        const evaluatorSignature = signatures.find(s => s.signer_type === 'evaluator');
        if (evaluatorSignature) {
            return;
        }

        try {
            await fetch(`/questionnaire/cold/${resolvedParams.id}/data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_observations',
                    observation_1: observation1,
                }),
            });
        } catch (error) {
            console.error('Error updating observations:', error);
        }
    };

    const validateEvaluatorForm = () => {
        const allAnswered = responses.every(r => r.percentage_value !== null);

        if (!allAnswered) {
            toast.error('Por favor responda todas las preguntas de evaluación');
            return false;
        }

        if (!observation1.trim()) {
            toast.error(
                'Se requiere la observación para poder firmar.',
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
                : null;

            const res = await fetch(`/questionnaire/cold/${resolvedParams.id}/data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sign_evaluator',
                    signer_name: evaluatorName.trim(),
                    average_score: average,
                    observation_1: observation1.trim(),
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al registrar la firma');
            }

            toast.success('Firma del evaluador registrada y cuestionario completado exitosamente');

            setTimeout(() => {
                router.push(`/course/${questionnaire?.course_participant.course_id}`);
            }, 1500);
        } catch (error: any) {
            console.error('Error signing questionnaire:', error);
            toast.error(error?.message || 'Error al registrar la firma');
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
            a.download = `Cuestionario_Frio_${questionnaire.course_participant.employee.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
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

                {!isAvailable && !isLocked && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div className="text-sm text-amber-800">
                            <strong>Cuestionario no disponible aún.</strong> Estará disponible a partir del{' '}
                            {questionnaire.available_from
                                ? format(new Date(questionnaire.available_from), 'dd/MM/yyyy')
                                : 'fecha especificada'}.
                        </div>
                    </div>
                )}

                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl">
                                    EVALUACIÓN DE EFECTIVIDAD (SEGUIMIENTO A 3 MESES / FRÍO)
                                </CardTitle>
                                <CardDescription className="mt-2">
                                    Evaluación de la aplicación de lo aprendido en el puesto de trabajo (a llenar por el Jefe Inmediato / Evaluador)
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
                                <span className="font-semibold text-gray-700">Nombre del Empleado:</span>{' '}
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
                                <span className="font-semibold text-gray-700">Fecha del Curso:</span>{' '}
                                {questionnaire.course_participant.course.start_date
                                    ? format(new Date(questionnaire.course_participant.course.start_date), 'dd/MM/yyyy')
                                    : 'N/A'}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Disponible desde:</span>{' '}
                                {questionnaire.available_from
                                    ? format(new Date(questionnaire.available_from), 'dd/MM/yyyy')
                                    : 'N/A'}
                            </div>
                            {questionnaire.average_score !== null && (
                                <div>
                                    <span className="font-semibold text-gray-700">Promedio de Efectividad:</span>{' '}
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
                        <CardTitle className="text-xl">EVALUACIÓN DE APLICACIÓN EN EL PUESTO</CardTitle>
                        <CardDescription>
                            Evalúe en qué porcentaje el empleado aplica en sus labores diarias los conocimientos y habilidades adquiridos
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {responses.map((q, idx) => (
                            <div key={q.id} className="border-b pb-4 last:border-0">
                                <Label className="text-base font-medium mb-3 block">
                                    {idx + 1}. {q.question_text}
                                </Label>
                                <RadioGroup
                                    disabled={isLocked || !isAvailable || !!evaluatorSignature}
                                    value={q.percentage_value?.toString() ?? ''}
                                    onValueChange={(val) => updateResponse(q.question_key, parseInt(val))}
                                    className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-2"
                                >
                                    {COLD_PERCENTAGE_OPTIONS.map(opt => (
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
                        <CardTitle className="text-xl">OBSERVACIONES DEL EVALUADOR</CardTitle>
                        <CardDescription>
                            Escriba las observaciones sobre la aplicación del entrenamiento en el puesto <span className="text-red-500">*</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            disabled={isLocked || !isAvailable || !!evaluatorSignature}
                            value={observation1}
                            onChange={(e) => setObservation1(e.target.value)}
                            onBlur={updateObservations}
                            placeholder="Comentarios u observaciones sobre el desempeño y aplicación..."
                            rows={4}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            FIRMA DEL JEFE INMEDIATO / EVALUADOR
                        </CardTitle>
                        <CardDescription>
                            {evaluatorSignature
                                ? 'La evaluación ha sido firmada por el evaluador'
                                : 'Ingrese su nombre completo para firmar electrónicamente esta evaluación'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {evaluatorSignature ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    <div>
                                        <div className="font-semibold text-green-900">
                                            Firmado por: {evaluatorSignature.signer_name} (Evaluador)
                                        </div>
                                        <div className="text-xs text-green-700">
                                            Fecha: {format(new Date(evaluatorSignature.signed_at), 'dd/MM/yyyy HH:mm')} hrs
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="evaluatorName">Nombre Completo del Evaluador / Jefe Inmediato *</Label>
                                    <Input
                                        id="evaluatorName"
                                        disabled={!isAvailable}
                                        value={evaluatorName}
                                        onChange={(e) => setEvaluatorName(e.target.value)}
                                        placeholder="Ingrese su nombre completo"
                                        className="mt-1"
                                    />
                                </div>
                                <Button
                                    onClick={handleEvaluatorSign}
                                    disabled={saving || !isAvailable}
                                    className="w-full bg-[#2166be] hover:bg-[#1a5299]"
                                    size="lg"
                                >
                                    {saving ? 'Guardando y Firmando...' : 'Firmar y Finalizar Evaluación'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

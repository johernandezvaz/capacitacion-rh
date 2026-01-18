"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Calendar, Clock, Users, FileText, AlertCircle, Pencil, Trash2, Download, ListCheck } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmployeeSearcher } from '@/components/employee-searcher';
import { EmployeeList } from '@/components/employee-list';
import { EditCourseModal } from '@/components/edit-course-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { supabase, Course, TrainingYear, EmployeeWithQuestionnaires } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
    isReady: boolean;
    reason?: string;
    details: {
        totalParticipants: number;
        completedHot: number;
        completedCold: number;
        signedCold: number;
        incompleteParticipants: Array<{
            employeeName: string;
            missingHot: boolean;
            missingCold: boolean;
            missingSignatures: boolean;
        }>;
    };
}

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | null>(null);
    const [year, setYear] = useState<TrainingYear | null>(null);
    const [employees, setEmployees] = useState<EmployeeWithQuestionnaires[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({
        open: false,
        type: '' as 'course' | '',
    });

    const fetchCourseData = async () => {
        try {
            const { data: courseData, error: courseError } = await supabase
                .from('courses')
                .select('*')
                .eq('id', params.id)
                .maybeSingle();

            if (courseError) throw courseError;
            if (!courseData) {
                router.push('/');
                return;
            }

            setCourse(courseData);

            const { data: yearData, error: yearError } = await supabase
                .from('training_years')
                .select('*')
                .eq('id', courseData.year_id)
                .maybeSingle();

            if (yearError) throw yearError;
            setYear(yearData);

            await fetchEmployees();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los datos del curso',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const { data: participantsData, error: participantsError } = await supabase
                .from('course_participants')
                .select(`
          id,
          enrolled_at,
          has_completed_hot,
          has_completed_cold,
          employee:employees(*)
        `)
                .eq('course_id', params.id);

            if (participantsError) throw participantsError;

            const participantIds = participantsData?.map((p: any) => p.id) || [];

            const { data: questionnaires } = await supabase
                .from('questionnaires')
                .select('*')
                .in('course_participant_id', participantIds);

            const questionnaireIds = questionnaires?.map((q) => q.id) || [];

            let signatures: any[] = [];
            if (questionnaireIds.length > 0) {
                const { data: signaturesData } = await supabase
                    .from('questionnaire_signatures')
                    .select('*')
                    .in('questionnaire_id', questionnaireIds);

                signatures = signaturesData || [];
            }

            const employeesWithQuestionnaires: EmployeeWithQuestionnaires[] = participantsData?.map((p: any) => {
                const hotQ = questionnaires?.find((q) => q.course_participant_id === p.id && q.type === 'hot') || null;
                const coldQ = questionnaires?.find((q) => q.course_participant_id === p.id && q.type === 'cold') || null;

                let coldQWithSignatures = coldQ;
                if (coldQ) {
                    const coldSignatures = signatures.filter((s) => s.questionnaire_id === coldQ.id);
                    const evaluatorSig = coldSignatures.find((s) => s.signer_type === 'evaluator');
                    const employeeSig = coldSignatures.find((s) => s.signer_type === 'employee');

                    coldQWithSignatures = {
                        ...coldQ,
                        evaluator_signed_at: evaluatorSig?.signed_at || null,
                        employee_signed_at: employeeSig?.signed_at || null,
                    };
                }

                return {
                    ...p.employee,
                    participant_id: p.id,
                    course_id: params.id as string,
                    hot_questionnaire: hotQ,
                    cold_questionnaire: coldQWithSignatures,
                };
            }) || [];

            setEmployees(employeesWithQuestionnaires);
            await validateCourseForPDF();
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const validateCourseForPDF = async () => {
        setIsValidating(true);
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            const response = await fetch(
                `${supabaseUrl}/functions/v1/validate-course-pdf?courseId=${params.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Error al validar el curso');
            }

            const result: ValidationResult = await response.json();
            setValidationResult(result);
        } catch (error) {
            console.error('Error validating course:', error);
            setValidationResult({
                isReady: false,
                reason: 'Error al validar el curso',
                details: {
                    totalParticipants: 0,
                    completedHot: 0,
                    completedCold: 0,
                    signedCold: 0,
                    incompleteParticipants: [],
                },
            });
        } finally {
            setIsValidating(false);
        }
    };

    useEffect(() => {
        fetchCourseData();
    }, [params.id]);

    const handleEmployeeAdded = () => {
        fetchEmployees();
    };

    const handleCourseUpdated = () => {
        fetchCourseData();
        setIsEditModalOpen(false);
    };

    const handleDeleteCourse = async () => {
        try {
            const { error: participantsError } = await supabase
                .from('course_participants')
                .delete()
                .eq('course_id', params.id);

            if (participantsError) throw participantsError;

            const { error: courseError } = await supabase
                .from('courses')
                .delete()
                .eq('id', params.id);

            if (courseError) throw courseError;

            toast({
                title: 'Éxito',
                description: 'Curso eliminado correctamente',
            });

            router.push(`/year/${course?.year_id}`);
        } catch (error: any) {
            console.error('Error deleting course:', error);
            toast({
                title: 'Error',
                description: error.message || 'No se pudo eliminar el curso',
                variant: 'destructive',
            });
        } finally {
            setDeleteDialog({ open: false, type: '' });
        }
    };

    const handleDownloadAttendanceList = async () => {
        if (!employees || employees.length === 0) {
            toast({
                title: 'Lista no disponible',
                description: 'El curso no tiene participantes inscritos',
                variant: 'destructive',
            });
            return;
        }

        setIsExporting(true);
        try {
            const response = await fetch(`/api/attendance-list/${params.id}`);
            console.log('Attendance list response:', response);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('Error response data:', errorData);
                throw new Error(errorData.error || 'Error al generar la lista de asistencia');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Lista_Asistencia_${course?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: 'Éxito',
                description: 'La lista de asistencia se ha descargado correctamente',
            });
        } catch (error) {
            console.error('Error downloading attendance list:', error);
            toast({
                title: 'Error',
                description: 'No se pudo generar la lista de asistencia',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!validationResult?.isReady) {
            toast({
                title: 'Exportación no disponible',
                description: validationResult?.reason || 'El curso no está listo para exportar',
                variant: 'destructive',
            });
            return;
        }

        setIsExporting(true);
        try {
            await validateCourseForPDF();

            if (!validationResult?.isReady) {
                throw new Error('El curso no cumple con los requisitos para exportar');
            }

            const response = await fetch(`/api/course-report/${params.id}`);

            if (!response.ok) {
                throw new Error('Error al generar el PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_${course?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: 'Éxito',
                description: 'El reporte PDF se ha descargado correctamente',
            });
        } catch (error) {
            console.error('Error exporting PDF:', error);
            toast({
                title: 'Error',
                description: 'No se pudo generar el reporte PDF',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-muted rounded w-64" />
                        <div className="h-12 bg-muted rounded w-96" />
                    </div>
                </div>
            </div>
        );
    }

    if (!course || !year) return null;

    const statusColors = {
        draft: 'bg-slate-100 text-slate-800',
        active: 'bg-emerald-100 text-emerald-800',
        closed: 'bg-red-100 text-red-800',
    };

    const statusLabels = {
        draft: 'Borrador',
        active: 'Activo',
        closed: 'Cerrado',
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 overflow-x-auto pb-2">
                    <Link href="/" className="hover:text-foreground transition-colors whitespace-nowrap">
                        Capacitaciones
                    </Link>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <Link href={`/year/${year.id}`} className="hover:text-foreground transition-colors whitespace-nowrap">
                        {year.year}
                    </Link>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-foreground font-medium truncate">{course.name}</span>
                </div>

                <Card className="mb-6 sm:mb-8 border-none shadow-lg">
                    <CardHeader className="pb-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                                    <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{course.name}</CardTitle>
                                    <Badge className={`${statusColors[course.status]} w-fit`}>
                                        {statusLabels[course.status]}
                                    </Badge>
                                </div>
                                <CardDescription className="text-sm sm:text-base">
                                    Año {year.year}
                                </CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="w-full sm:w-auto"
                                >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeleteDialog({ open: true, type: 'course' })}
                                    className="text-red-600 hover:text-red-700 w-full sm:w-auto"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardHeader className="pt-0 pb-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-end gap-2 w-full">
                            <Button
                                onClick={handleDownloadAttendanceList}
                                disabled={isExporting || !employees || employees.length === 0}
                                variant="outline"
                                className="flex items-center justify-center gap-2 w-full sm:w-auto"
                            >
                                <ListCheck className="w-4 h-4" />
                                <span>Lista de Asistencia</span>
                            </Button>
                            {!validationResult?.isReady ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="w-full sm:w-auto">
                                                <Button
                                                    onClick={handleExportPDF}
                                                    disabled={true}
                                                    variant="outline"
                                                    className="flex items-center justify-center gap-2 cursor-not-allowed opacity-50 w-full sm:w-auto"
                                                >
                                                    <AlertCircle className="w-4 h-4" />
                                                    <span>Reporte Completo</span>
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm p-4" side="bottom">
                                            <div className="space-y-2">
                                                <p className="font-semibold text-sm">Reporte no disponible</p>
                                                <p className="text-sm">{validationResult?.reason || 'Faltan cuestionarios por completar'}</p>
                                                {validationResult?.details && validationResult.details.incompleteParticipants.length > 0 && (
                                                    <div className="mt-3 space-y-1">
                                                        <p className="font-semibold text-xs">Participantes pendientes:</p>
                                                        <ul className="text-xs space-y-1">
                                                            {validationResult.details.incompleteParticipants.slice(0, 5).map((p, idx) => (
                                                                <li key={idx} className="flex items-start gap-1">
                                                                    <span>•</span>
                                                                    <span>
                                                                        <strong>{p.employeeName}</strong>
                                                                        {p.missingHot && ' - Falta cuestionario empleado firmado'}
                                                                        {p.missingCold && ' - Falta cuestionario evaluador firmado'}
                                                                        {p.missingSignatures && ' - Faltan firmas'}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                            {validationResult.details.incompleteParticipants.length > 5 && (
                                                                <li className="text-muted-foreground">
                                                                    ... y {validationResult.details.incompleteParticipants.length - 5} más
                                                                </li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <Button
                                    onClick={handleExportPDF}
                                    disabled={isExporting}
                                    variant="outline"
                                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>{isExporting ? 'Generando...' : 'Reporte Completo'}</span>
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex-shrink-0">
                                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm text-muted-foreground">Fecha</p>
                                    <p className="font-semibold text-sm sm:text-base truncate">
                                        {new Date(course.date).toLocaleDateString('es-MX', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 flex-shrink-0">
                                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Duración</p>
                                    <p className="font-semibold text-sm sm:text-base">{course.duration_hours} horas</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
                                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex-shrink-0">
                                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Participantes</p>
                                    <p className="font-semibold text-sm sm:text-base">{employees.length}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl">Agregar Empleado</CardTitle>
                            <CardDescription>
                                Busca empleados existentes o crea uno nuevo
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EmployeeSearcher
                                courseId={params.id as string}
                                onEmployeeAdded={handleEmployeeAdded}
                                existingEmployeeIds={employees.map(e => e.id)}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl">Participantes del Curso</CardTitle>
                            <CardDescription>
                                Lista de empleados inscritos y estado de sus cuestionarios
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EmployeeList
                                employees={employees}
                                onRefresh={fetchEmployees}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {course && (
                <EditCourseModal
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    course={course}
                    onSuccess={handleCourseUpdated}
                />
            )}

            <ConfirmDialog
                open={deleteDialog.open && deleteDialog.type === 'course'}
                onOpenChange={(open) =>
                    setDeleteDialog({ open, type: open ? deleteDialog.type : '' })
                }
                title="¿Eliminar curso?"
                description={`¿Estás seguro de que deseas eliminar el curso "${course?.name}"? Esta acción eliminará todos los participantes y cuestionarios asociados. Esta acción no se puede deshacer.`}
                confirmText="Eliminar Curso"
                onConfirm={handleDeleteCourse}
                variant="destructive"
            />
        </div>
    );
}

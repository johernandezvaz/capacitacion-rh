"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Calendar, Clock, Users, FileText, AlertCircle, Pencil, Trash2 } from 'lucide-react';
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

            const employeesWithQuestionnaires: EmployeeWithQuestionnaires[] = participantsData?.map((p: any) => {
                const hotQ = questionnaires?.find((q) => q.course_participant_id === p.id && q.type === 'hot') || null;
                const coldQ = questionnaires?.find((q) => q.course_participant_id === p.id && q.type === 'cold') || null;

                return {
                    ...p.employee,
                    participant_id: p.id,
                    hot_questionnaire: hotQ,
                    cold_questionnaire: coldQ,
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
        <div className="min-h-screen p-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Link href="/" className="hover:text-foreground transition-colors">
                        Capacitaciones
                    </Link>
                    <ChevronRight className="w-4 h-4" />
                    <Link href={`/year/${year.id}`} className="hover:text-foreground transition-colors">
                        {year.year}
                    </Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-foreground font-medium">{course.name}</span>
                </div>

                <Card className="mb-8 border-none shadow-lg">
                    <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <CardTitle className="text-3xl font-bold">{course.name}</CardTitle>
                                    <Badge className={statusColors[course.status]}>
                                        {statusLabels[course.status]}
                                    </Badge>
                                </div>
                                <CardDescription className="text-base">
                                    Año {year.year}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditModalOpen(true)}
                                >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeleteDialog({ open: true, type: 'course' })}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardHeader className="pt-0 pb-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1"></div>
                            {!validationResult?.isReady ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <Button
                                                    onClick={handleExportPDF}
                                                    disabled={true}
                                                    variant="outline"
                                                    className="flex items-center gap-2 cursor-not-allowed opacity-50"
                                                >
                                                    <AlertCircle className="w-4 h-4" />
                                                    Exportar PDF
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm p-4" side="bottom">
                                            <div className="space-y-2">
                                                <p className="font-semibold text-sm">Exportación no disponible</p>
                                                <p className="text-sm">{validationResult?.reason || 'El curso no está listo para exportar'}</p>
                                                {validationResult?.details && validationResult.details.incompleteParticipants.length > 0 && (
                                                    <div className="mt-3 space-y-1">
                                                        <p className="font-semibold text-xs">Participantes pendientes:</p>
                                                        <ul className="text-xs space-y-1">
                                                            {validationResult.details.incompleteParticipants.slice(0, 5).map((p, idx) => (
                                                                <li key={idx} className="flex items-start gap-1">
                                                                    <span>•</span>
                                                                    <span>
                                                                        <strong>{p.employeeName}</strong>
                                                                        {p.missingHot && ' - Falta cuestionario caliente'}
                                                                        {p.missingCold && ' - Falta cuestionario frío'}
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
                                    className="flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    {isExporting ? 'Generando...' : 'Exportar PDF'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Fecha</p>
                                    <p className="font-semibold">
                                        {new Date(course.date).toLocaleDateString('es-MX', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Duración</p>
                                    <p className="font-semibold">{course.duration_hours} horas</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                                    <Users className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Participantes</p>
                                    <p className="font-semibold">{employees.length}</p>
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

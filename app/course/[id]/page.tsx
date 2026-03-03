"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Calendar, Clock, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmployeeSearcher } from '@/components/employee-searcher';
import { EmployeeList } from '@/components/employee-list';
import { supabase, Course, TrainingYear, EmployeeWithQuestionnaires } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | null>(null);
    const [year, setYear] = useState<TrainingYear | null>(null);
    const [employees, setEmployees] = useState<EmployeeWithQuestionnaires[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

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
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    useEffect(() => {
        fetchCourseData();
    }, [params.id]);

    const handleEmployeeAdded = () => {
        fetchEmployees();
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
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
                            <Button
                                onClick={handleExportPDF}
                                disabled={isExporting || employees.length === 0}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                {isExporting ? 'Generando...' : 'Exportar PDF'}
                            </Button>
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

                        {(course.start_date || course.end_date) && (
                            <div className="mt-6 pt-6 border-t">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100">
                                        <Calendar className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Duración del Curso</p>
                                        <p className="font-semibold">
                                            {course.start_date && course.end_date ? (
                                                <>
                                                    {new Date(course.start_date).toLocaleDateString('es-MX', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}
                                                    {' – '}
                                                    {new Date(course.end_date).toLocaleDateString('es-MX', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}
                                                </>
                                            ) : course.start_date ? (
                                                <>
                                                    Inicia el {new Date(course.start_date).toLocaleDateString('es-MX', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}
                                                </>
                                            ) : null}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
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
        </div>
    );
}

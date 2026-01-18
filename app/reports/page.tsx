'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Course {
    id: string;
    name: string;
    date: string;
    year_id: string;
    year?: { year: number };
}

interface ReportStatus {
    courseId: string;
    hotReportAvailable: boolean;
    coldReportAvailable: boolean;
    hotReportMessage: string;
    coldReportMessage: string;
    totalParticipants: number;
    completedHot: number;
    completedCold: number;
}

export default function ReportsPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [reportStatuses, setReportStatuses] = useState<Record<string, ReportStatus>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCourses();
    }, []);

    async function loadCourses() {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, date, year_id, training_years(year)')
                .order('date', { ascending: false });

            if (error) throw error;

            const coursesData = data.map((course: any) => ({
                ...course,
                year: course.training_years
            }));

            setCourses(coursesData);

            const statuses: Record<string, ReportStatus> = {};
            for (const course of coursesData) {
                statuses[course.id] = await checkReportAvailability(course.id);
            }
            setReportStatuses(statuses);
        } catch (error) {
            console.error('Error loading courses:', error);
            toast.error('Error al cargar cursos');
        } finally {
            setLoading(false);
        }
    }

    async function checkReportAvailability(courseId: string): Promise<ReportStatus> {
        try {
            const { data: participants, error } = await supabase
                .from('course_participants')
                .select(`
          id,
          hot_questionnaires(completed_at),
          cold_questionnaires(evaluator_name, signature_employee_name, signature_date)
        `)
                .eq('course_id', courseId);

            if (error) throw error;

            const totalParticipants = participants?.length || 0;

            if (totalParticipants === 0) {
                return {
                    courseId,
                    hotReportAvailable: false,
                    coldReportAvailable: false,
                    hotReportMessage: 'No hay participantes inscritos',
                    coldReportMessage: 'No hay participantes inscritos',
                    totalParticipants: 0,
                    completedHot: 0,
                    completedCold: 0
                };
            }

            const completedHot = participants?.filter((p: any) =>
                p.hot_questionnaires?.length > 0 && p.hot_questionnaires[0].completed_at
            ).length || 0;

            const completedCold = participants?.filter((p: any) => {
                const hasCold = p.cold_questionnaires?.length > 0;
                if (!hasCold) return false;
                const cold = p.cold_questionnaires[0];
                return cold.evaluator_name && cold.signature_employee_name && cold.signature_date;
            }).length || 0;

            const hotReportAvailable = completedHot === totalParticipants;
            const coldReportAvailable = completedHot === totalParticipants && completedCold === totalParticipants;

            let hotReportMessage = '';
            let coldReportMessage = '';

            if (!hotReportAvailable) {
                const pending = totalParticipants - completedHot;
                hotReportMessage = `${pending} participante${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de completar cuestionario caliente`;
            } else {
                hotReportMessage = 'Disponible';
            }

            if (!coldReportAvailable) {
                if (completedHot < totalParticipants) {
                    const pendingHot = totalParticipants - completedHot;
                    coldReportMessage = `${pendingHot} participante${pendingHot > 1 ? 's' : ''} pendiente${pendingHot > 1 ? 's' : ''} de completar cuestionario caliente`;
                } else {
                    const pendingCold = totalParticipants - completedCold;
                    coldReportMessage = `${pendingCold} participante${pendingCold > 1 ? 's' : ''} pendiente${pendingCold > 1 ? 's' : ''} de completar cuestionario frío`;
                }
            } else {
                coldReportMessage = 'Disponible';
            }

            return {
                courseId,
                hotReportAvailable,
                coldReportAvailable,
                hotReportMessage,
                coldReportMessage,
                totalParticipants,
                completedHot,
                completedCold
            };
        } catch (error) {
            console.error('Error checking report availability:', error);
            return {
                courseId,
                hotReportAvailable: false,
                coldReportAvailable: false,
                hotReportMessage: 'Error al verificar disponibilidad',
                coldReportMessage: 'Error al verificar disponibilidad',
                totalParticipants: 0,
                completedHot: 0,
                completedCold: 0
            };
        }
    }

    async function handleDownloadReport(courseId: string, type: 'hot' | 'cold') {
        try {
            const response = await fetch(`/api/course-report/${courseId}?type=${type}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al generar reporte');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const course = courses.find(c => c.id === courseId);
            const courseName = course?.name || 'Curso';
            const reportType = type === 'hot' ? 'Caliente' : 'Frio';

            a.download = `Reporte_${reportType}_${courseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Reporte ${type === 'hot' ? 'caliente' : 'frío'} generado exitosamente`);
        } catch (error: any) {
            console.error('Error downloading report:', error);
            toast.error(error.message || 'Error al descargar reporte');
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Cargando cursos...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Reportes de Cursos</h1>
                <p className="text-muted-foreground">
                    Genera reportes calientes y fríos para todos los cursos
                </p>
            </div>

            {courses.length === 0 ? (
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center text-muted-foreground">
                            No hay cursos registrados
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {courses.map((course) => {
                        const status = reportStatuses[course.id];

                        return (
                            <Card key={course.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl">{course.name}</CardTitle>
                                            <CardDescription>
                                                Año: {course.year?.year || 'N/A'} | Fecha: {new Date(course.date).toLocaleDateString('es-MX')}
                                            </CardDescription>
                                        </div>
                                        {status && (
                                            <Badge variant="outline">
                                                {status.completedHot}/{status.totalParticipants} caliente | {status.completedCold}/{status.totalParticipants} frío
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {status ? (
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="border rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <FileText className="h-5 w-5 text-orange-500" />
                                                    <h3 className="font-semibold">Reporte Caliente</h3>
                                                </div>

                                                <div className="mb-4">
                                                    {status.hotReportAvailable ? (
                                                        <Badge variant="default" className="bg-green-500">
                                                            {status.hotReportMessage}
                                                        </Badge>
                                                    ) : (
                                                        <div className="flex items-start gap-2 text-sm text-amber-600">
                                                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                            <span>{status.hotReportMessage}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <Button
                                                    onClick={() => handleDownloadReport(course.id, 'hot')}
                                                    disabled={!status.hotReportAvailable}
                                                    className="w-full"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Descargar Reporte Caliente
                                                </Button>
                                            </div>

                                            <div className="border rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <FileText className="h-5 w-5 text-blue-500" />
                                                    <h3 className="font-semibold">Reporte Frío</h3>
                                                </div>

                                                <div className="mb-4">
                                                    {status.coldReportAvailable ? (
                                                        <Badge variant="default" className="bg-green-500">
                                                            {status.coldReportMessage}
                                                        </Badge>
                                                    ) : (
                                                        <div className="flex items-start gap-2 text-sm text-amber-600">
                                                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                            <span>{status.coldReportMessage}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <Button
                                                    onClick={() => handleDownloadReport(course.id, 'cold')}
                                                    disabled={!status.coldReportAvailable}
                                                    className="w-full"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Descargar Reporte Frío
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-muted-foreground">
                                            Verificando disponibilidad...
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

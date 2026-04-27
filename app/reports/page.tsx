'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Download, AlertCircle, Search } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
            const { data: participants, error: participantsError } = await supabase
                .from('course_participants')
                .select('id')
                .eq('course_id', courseId);

            if (participantsError) throw participantsError;

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

            const participantIds = participants.map((p) => p.id);

            const { data: questionnaires, error: questionnairesError } = await supabase
                .from('questionnaires')
                .select('id, course_participant_id, type, submitted_at, observation_1, observation_2, observation_3')
                .in('course_participant_id', participantIds);

            if (questionnairesError) throw questionnairesError;

            const { data: signatures, error: signaturesError } = await supabase
                .from('questionnaire_signatures')
                .select('questionnaire_id, signer_type')
                .in('questionnaire_id', questionnaires?.map((q) => q.id) || []);

            if (signaturesError) throw signaturesError;

            let completedHot = 0;
            let completedCold = 0;

            for (const participant of participants) {
                const hotQ = questionnaires?.find(
                    (q: any) => q.course_participant_id === participant.id && q.type === 'hot'
                );
                const coldQ = questionnaires?.find(
                    (q: any) => q.course_participant_id === participant.id && q.type === 'cold'
                );

                if (hotQ && hotQ.submitted_at) {
                    const hotSignature = signatures?.find(
                        (s: any) => s.questionnaire_id === hotQ.id && s.signer_type === 'employee'
                    );
                    if (hotSignature) {
                        completedHot++;
                    }
                }

                if (coldQ && coldQ.submitted_at) {
                    const hasObservations =
                        coldQ.observation_1 && coldQ.observation_2 && coldQ.observation_3;
                    const evaluatorSig = signatures?.find(
                        (s: any) => s.questionnaire_id === coldQ.id && s.signer_type === 'evaluator'
                    );
                    const employeeSig = signatures?.find(
                        (s: any) => s.questionnaire_id === coldQ.id && s.signer_type === 'employee'
                    );

                    if (hasObservations && evaluatorSig && employeeSig) {
                        completedCold++;
                    }
                }
            }

            const hotReportAvailable = completedHot === totalParticipants;
            const coldReportAvailable = completedHot === totalParticipants && completedCold === totalParticipants;

            let hotReportMessage = '';
            let coldReportMessage = '';

            if (!hotReportAvailable) {
                const pending = totalParticipants - completedHot;
                hotReportMessage = `${pending} participante${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de completar cuestionario empleado`;
            } else {
                hotReportMessage = 'Disponible';
            }

            if (!coldReportAvailable) {
                if (completedHot < totalParticipants) {
                    const pendingHot = totalParticipants - completedHot;
                    coldReportMessage = `${pendingHot} participante${pendingHot > 1 ? 's' : ''} pendiente${pendingHot > 1 ? 's' : ''} de completar cuestionario empleado`;
                } else {
                    const pendingCold = totalParticipants - completedCold;
                    coldReportMessage = `${pendingCold} participante${pendingCold > 1 ? 's' : ''} pendiente${pendingCold > 1 ? 's' : ''} de completar cuestionario evaluador`;
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
            const reportType = type === 'hot' ? 'Empleado' : 'Evaluador';

            a.download = `Reporte_${reportType}_${courseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Reporte ${type === 'hot' ? 'empleado' : 'evaluador'} generado exitosamente`);
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

    const filteredCourses = courses.filter((course) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedCourses = (() => {
        const groups: Record<string, { label: string; sortKey: string; courses: Course[] }> = {};
        const noDateCourses: Course[] = [];

        filteredCourses.forEach(course => {
            if (!course.date) {
                noDateCourses.push(course);
            } else {
                const d = new Date(course.date + 'T12:00:00');
                const month = d.toLocaleString('es-ES', { month: 'long' });
                const yearVal = d.getFullYear();
                const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
                const label = `${monthCap} ${yearVal}`;
                const sortKey = `${yearVal}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                if (!groups[sortKey]) {
                    groups[sortKey] = { label, sortKey, courses: [] };
                }
                groups[sortKey].courses.push(course);
            }
        });

        const sortedGroups = Object.values(groups).sort((a, b) => {
            return sortOrder === 'desc'
                ? b.sortKey.localeCompare(a.sortKey)
                : a.sortKey.localeCompare(b.sortKey);
        });

        sortedGroups.forEach(group => {
            group.courses.sort((a, b) => {
                const dateA = a.date || '';
                const dateB = b.date || '';
                return sortOrder === 'desc'
                    ? dateB.localeCompare(dateA)
                    : dateA.localeCompare(dateB);
            });
        });

        if (noDateCourses.length > 0) {
            sortedGroups.push({ label: 'Sin fecha', sortKey: sortOrder === 'desc' ? '0000-00' : '9999-99', courses: noDateCourses });
        }

        return sortedGroups;
    })();

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Reportes de Cursos</h1>
                <p className="text-muted-foreground">
                    Genera reportes de empleados y evaluadores para todos los cursos
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
                <>
                    <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Buscar curso por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full"
                            />
                        </div>
                        <div className="w-full sm:w-64 shrink-0">
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                            >
                                <option value="desc">Más reciente primero</option>
                                <option value="asc">Más antiguo primero</option>
                            </select>
                        </div>
                    </div>
                    {searchTerm && (
                        <p className="text-sm text-muted-foreground mb-6">
                            Mostrando {filteredCourses.length} de {courses.length} cursos
                        </p>
                    )}

                    {groupedCourses.length === 0 ? (
                        <Card>
                            <CardContent className="py-8">
                                <div className="text-center text-muted-foreground">
                                    No se encontraron cursos que coincidan con la búsqueda
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-8">
                            {groupedCourses.map((group) => (
                                <div key={group.sortKey} className="space-y-4">
                                    <h2 className="text-xl font-semibold text-foreground border-b pb-2">{group.label}</h2>
                                    <div className="grid gap-6">
                                        {group.courses.map((course) => {
                                            const status = reportStatuses[course.id];

                                            return (
                                                <Card key={course.id}>
                                                    <CardHeader>
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <CardTitle className="text-xl">{course.name}</CardTitle>
                                                                <CardDescription>
                                                                    Año: {course.year?.year || 'N/A'} | Fecha: {new Date(course.date + 'T12:00:00').toLocaleDateString('es-MX')}
                                                                </CardDescription>
                                                            </div>
                                                            {status && (
                                                                <Badge variant="outline">
                                                                    {status.completedHot}/{status.totalParticipants} empleado | {status.completedCold}/{status.totalParticipants} evaluador
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
                                                                        <h3 className="font-semibold">Reporte Empleado</h3>
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
                                                                        Descargar Reporte Empleado
                                                                    </Button>
                                                                </div>

                                                                <div className="border rounded-lg p-4">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <FileText className="h-5 w-5 text-blue-500" />
                                                                        <h3 className="font-semibold">Reporte Evaluador</h3>
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
                                                                        Descargar Reporte Evaluador
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
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

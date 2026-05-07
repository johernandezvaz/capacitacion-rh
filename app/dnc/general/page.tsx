"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileBarChart2, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

type CourseEntry = {
    id: string;
    name: string;
    training_year: number | null;
    participant_count: number;
};

export default function DncGeneralPage() {
    const router = useRouter();
    const { plantId } = useAuth();

    const [courses, setCourses] = useState<CourseEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchName, setSearchName] = useState('');
    const [filterYear, setFilterYear] = useState('');

    useEffect(() => {
        if (plantId) fetchCourses();
    }, [plantId]);

    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            const { data: coursesData, error: coursesError } = await supabase
                .from('courses')
                .select(`
                    id, name,
                    training_years!year_id(year)
                `)
                .eq('plant_id', plantId)
                .order('name', { ascending: true });

            if (coursesError) throw coursesError;

            const { data: countData, error: countError } = await supabase
                .from('course_participants')
                .select('course_id');

            if (countError) throw countError;

            const countMap: Record<string, number> = {};
            (countData || []).forEach((row: any) => {
                countMap[row.course_id] = (countMap[row.course_id] || 0) + 1;
            });

            const entries: CourseEntry[] = (coursesData || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                training_year: c.training_years?.year ?? null,
                participant_count: countMap[c.id] || 0,
            }));

            entries.sort((a, b) => {
                const yearDiff = (b.training_year ?? 0) - (a.training_year ?? 0);
                if (yearDiff !== 0) return yearDiff;
                return a.name.localeCompare(b.name);
            });

            setCourses(entries);
        } catch (error: any) {
            console.error('Error fetching DNC general:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const uniqueYears = Array.from(
        new Set(courses.map(c => c.training_year).filter(Boolean))
    ).sort((a, b) => (b as number) - (a as number)) as number[];

    const filtered = courses.filter(c => {
        const matchName = !searchName || c.name.toLowerCase().includes(searchName.toLowerCase());
        const matchYear = !filterYear || String(c.training_year) === filterYear;
        return matchName && matchYear;
    });

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-5xl mx-auto">

                <div className="flex items-center gap-3 mb-8">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 flex-shrink-0">
                        <FileBarChart2 className="w-6 h-6 text-[#2166be]" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">DNC General</h1>
                        <p className="text-muted-foreground text-sm">
                            Vista de todos los cursos con su DNC y participantes
                        </p>
                    </div>
                </div>

                <Card className="border-none shadow-md mb-6">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre de curso..."
                                    value={searchName}
                                    onChange={e => setSearchName(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {uniqueYears.length > 1 && (
                                <select
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2166be] min-w-[130px]"
                                >
                                    <option value="">Todos los años</option>
                                    {uniqueYears.map(y => (
                                        <option key={y} value={String(y)}>{y}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Cursos</CardTitle>
                            <Badge variant="secondary">{filtered.length}</Badge>
                        </div>
                        <CardDescription>
                            Haz clic en "Ver DNC" para ver y editar el DNC de cada curso
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {isLoading ? (
                            <div className="animate-pulse space-y-3 py-6">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-12 bg-muted rounded" />
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-16">
                                <FileBarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                <p className="text-muted-foreground text-sm">
                                    {searchName || filterYear
                                        ? 'No se encontraron cursos con esos filtros'
                                        : 'No hay cursos registrados'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Nombre del Curso</th>
                                                <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Año</th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-[#192b52]">Participantes</th>
                                                <th className="text-right py-3 px-4 text-sm font-semibold text-[#192b52]">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((course, i) => (
                                                <tr
                                                    key={course.id}
                                                    className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}
                                                >
                                                    <td className="py-3 px-4 text-sm font-medium">{course.name}</td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">
                                                        {course.training_year ?? '—'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge variant="secondary">{course.participant_count}</Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white"
                                                            onClick={() => router.push(`/course/${course.id}/dnc`)}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                                            Ver DNC
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="md:hidden space-y-3 pt-3">
                                    {filtered.map(course => (
                                        <div key={course.id} className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm break-words">{course.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {course.training_year && (
                                                            <span className="text-xs text-muted-foreground">{course.training_year}</span>
                                                        )}
                                                        <Badge variant="secondary" className="text-xs">
                                                            {course.participant_count} participantes
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white flex-shrink-0"
                                                    onClick={() => router.push(`/course/${course.id}/dnc`)}
                                                >
                                                    Ver DNC
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

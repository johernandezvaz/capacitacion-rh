"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

type CourseRow = {
    id: string;
    name: string;
    date: string | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    comentario_dnc: string | null;
};

function parseMonthYear(dateStr: string | null): { month: number; year: number } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T12:00:00');
    return { month: d.getMonth(), year: d.getFullYear() };
}

function getCellColor(course: CourseRow, monthIndex: number, year: number): string | null {
    const real = parseMonthYear(course.fecha_real);
    const prog = parseMonthYear(course.fecha_programada);
    const main = parseMonthYear(course.date);

    if (real && real.month === monthIndex && real.year === year) return '#2166be';
    if (prog && prog.month === monthIndex && prog.year === year) return '#93c5fd';
    if (
        main && main.month === monthIndex && main.year === year &&
        !course.fecha_real && !course.fecha_programada
    ) return '#2166be';
    return null;
}

export default function DncPage() {
    const { plantId } = useAuth();
    const currentYear = new Date().getFullYear();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [years, setYears] = useState<number[]>([currentYear]);
    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [comments, setComments] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (plantId) fetchYears();
    }, [plantId]);

    useEffect(() => {
        if (plantId) fetchCourses();
    }, [plantId, selectedYear]);

    const fetchYears = async () => {
        const { data } = await supabase
            .from('courses')
            .select('date')
            .eq('plant_id', plantId)
            .not('date', 'is', null);

        if (data) {
            const uniqueYears = new Set<number>([currentYear]);
            (data as any[]).forEach((row) => {
                if (row.date) uniqueYears.add(new Date(row.date + 'T12:00:00').getFullYear());
            });
            setYears(Array.from(uniqueYears).sort((a, b) => b - a));
        }
    };

    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, date, fecha_programada, fecha_real, comentario_dnc')
                .eq('plant_id', plantId)
                .gte('date', `${selectedYear}-01-01`)
                .lte('date', `${selectedYear}-12-31`)
                .order('date', { ascending: true });

            if (error) throw error;

            const rows: CourseRow[] = (data || []) as CourseRow[];
            setCourses(rows);

            const init: Record<string, string> = {};
            rows.forEach((c) => { init[c.id] = c.comentario_dnc || ''; });
            setComments(init);
        } catch (err) {
            console.error('Error fetching courses for DNC:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCommentBlur = async (courseId: string) => {
        const value = comments[courseId] ?? '';
        await supabase
            .from('courses')
            .update({ comentario_dnc: value.trim() || null })
            .eq('id', courseId);
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-full">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 flex-shrink-0">
                            <CalendarDays className="w-6 h-6 text-[#2166be]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Calendario de Capacitación</h1>
                            <p className="text-muted-foreground text-sm">Timesheet anual de capacitaciones</p>
                        </div>
                    </div>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be] w-fit"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div className="rounded-lg border border-gray-200 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table
                            className="border-collapse w-full"
                            style={{ minWidth: '900px' }}
                        >
                            <thead>
                                <tr style={{ background: '#192b52' }}>
                                    <th
                                        className="sticky left-0 z-20 text-left px-3 py-3 text-xs font-semibold text-white border-r"
                                        style={{ width: 280, minWidth: 280, background: '#192b52', borderColor: 'rgba(255,255,255,0.15)' }}
                                    >
                                        TEMA
                                    </th>
                                    {MONTHS.map((m) => (
                                        <th
                                            key={m}
                                            className="text-center px-0 py-3 text-xs font-semibold text-white border-r"
                                            style={{ width: 48, minWidth: 48, borderColor: 'rgba(255,255,255,0.15)' }}
                                        >
                                            {m}
                                        </th>
                                    ))}
                                    <th
                                        className="text-left px-3 py-3 text-xs font-semibold text-white"
                                        style={{ width: 200, minWidth: 200 }}
                                    >
                                        COMENTARIO
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={15} className="text-center py-16 text-muted-foreground text-sm">
                                            Cargando...
                                        </td>
                                    </tr>
                                ) : courses.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="text-center py-16 text-muted-foreground text-sm">
                                            No hay cursos registrados para {selectedYear}
                                        </td>
                                    </tr>
                                ) : (
                                    courses.map((course, i) => {
                                        const isEven = i % 2 === 0;
                                        const rowBg = isEven ? '#ffffff' : '#f8fafc';
                                        const hoverBg = '#f1f5f9';

                                        return (
                                            <tr
                                                key={course.id}
                                                style={{ background: rowBg }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                                            >
                                                <td
                                                    className="sticky left-0 z-10 px-3 py-2 border-r border-b border-gray-100 text-sm"
                                                    style={{ width: 280, minWidth: 280, background: 'inherit' }}
                                                >
                                                    <Link
                                                        href={`/course/${course.id}`}
                                                        className="text-[#2166be] hover:text-[#1a5299] hover:underline font-medium leading-snug"
                                                    >
                                                        {course.name}
                                                    </Link>
                                                </td>

                                                {MONTHS.map((_, mi) => {
                                                    const color = getCellColor(course, mi, selectedYear);
                                                    return (
                                                        <td
                                                            key={mi}
                                                            className="border-r border-b border-gray-100"
                                                            style={{ width: 48, minWidth: 48, padding: '6px 4px' }}
                                                        >
                                                            {color && (
                                                                <div
                                                                    className="mx-auto rounded-sm"
                                                                    style={{ background: color, width: 32, height: 22 }}
                                                                />
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                <td
                                                    className="px-2 py-1 border-b border-gray-100"
                                                    style={{ width: 200, minWidth: 200 }}
                                                >
                                                    <input
                                                        type="text"
                                                        value={comments[course.id] ?? ''}
                                                        onChange={(e) =>
                                                            setComments((prev) => ({ ...prev, [course.id]: e.target.value }))
                                                        }
                                                        onBlur={() => handleCommentBlur(course.id)}
                                                        placeholder="—"
                                                        className="w-full text-sm bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[#2166be] rounded px-1 py-0.5 placeholder:text-gray-300 transition-all"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {!isLoading && courses.length > 0 && (
                    <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-4 rounded-sm" style={{ background: '#2166be' }} />
                            <span className="text-xs text-muted-foreground">Realizado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-4 rounded-sm" style={{ background: '#93c5fd' }} />
                            <span className="text-xs text-muted-foreground">Programado</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

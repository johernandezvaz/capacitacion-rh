"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTrainingYears } from '@/hooks/use-training-years';
import { STATUS_CONFIG, COLORES_DETECCION } from '@/lib/detecciones-utils';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const TOTAL_COLS = 15;

type CourseRow = {
    id: string;
    name: string;
    fecha_programada: string | null;
    fecha_real: string | null;
    comentario_dnc: string | null;
};

type DeteccionRow = {
    id: string;
    nombre: string;
    color: string;
    status: string | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    departamentos: string;
};

function parseMonthYear(dateStr: string | null): { month: number; year: number } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T12:00:00');
    return { month: d.getMonth(), year: d.getFullYear() };
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function getCourseCellColor(course: CourseRow, monthIndex: number, year: number): string | null {
    const real = parseMonthYear(course.fecha_real);
    const prog = parseMonthYear(course.fecha_programada);
    if (real && real.month === monthIndex && real.year === year) return '#2166be';
    if (prog && prog.month === monthIndex && prog.year === year) return '#93c5fd';
    return null;
}

function getDetCellColor(det: DeteccionRow, monthIndex: number, year: number): string | null {
    const real = parseMonthYear(det.fecha_real);
    const prog = parseMonthYear(det.fecha_programada);
    const col = det.color || '#2166be';
    if (real && real.month === monthIndex && real.year === year) return col;
    if (prog && prog.month === monthIndex && prog.year === year) return hexToRgba(col, 0.45);
    return null;
}

export default function DncPage() {
    const { plantId } = useAuth();
    const { years, selectedYearId, setSelectedYearId, selectedYear } = useTrainingYears();

    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [detecciones, setDetecciones] = useState<DeteccionRow[]>([]);
    const [comments, setComments] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (plantId && selectedYearId) fetchData();
    }, [plantId, selectedYearId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: coursesData, error: cErr } = await supabase
                .from('courses')
                .select('id, name, fecha_programada, fecha_real, comentario_dnc')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId)
                .order('name', { ascending: true });
            if (cErr) throw cErr;

            const rows: CourseRow[] = coursesData || [];
            setCourses(rows);
            const init: Record<string, string> = {};
            rows.forEach(c => { init[c.id] = c.comentario_dnc || ''; });
            setComments(init);

            const { data: detData } = await supabase
                .from('detecciones')
                .select('id, nombre, color, status, fecha_programada, fecha_real')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId)
                .order('fecha_programada', { ascending: true, nullsFirst: false });

            const dets: DeteccionRow[] = [];
            if (detData && detData.length > 0) {
                const detIds = detData.map((d: any) => d.id);
                const { data: deptLinks } = await supabase
                    .from('deteccion_departamentos')
                    .select('deteccion_id, departamentos!departamento_id(codigo)')
                    .in('deteccion_id', detIds);

                const deptMap: Record<string, string[]> = {};
                (deptLinks || []).forEach((row: any) => {
                    const codigo = row.departamentos?.codigo;
                    if (!codigo) return;
                    if (!deptMap[row.deteccion_id]) deptMap[row.deteccion_id] = [];
                    deptMap[row.deteccion_id].push(codigo);
                });

                for (const d of detData as any[]) {
                    dets.push({
                        id: d.id,
                        nombre: d.nombre,
                        color: d.color || '#2166be',
                        status: d.status,
                        fecha_programada: d.fecha_programada,
                        fecha_real: d.fecha_real,
                        departamentos: (deptMap[d.id] || []).sort().join(', '),
                    });
                }
            }
            setDetecciones(dets);
        } catch (err) {
            console.error('Error fetching DNC data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCommentBlur = async (courseId: string) => {
        const value = comments[courseId] ?? '';
        await supabase.from('courses').update({ comentario_dnc: value.trim() || null }).eq('id', courseId);
    };

    const hasCourses = courses.length > 0;
    const hasDets = detecciones.length > 0;
    const isEmpty = !hasCourses && !hasDets;

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
                            <p className="text-muted-foreground text-sm">Timesheet anual de capacitaciones y detecciones</p>
                        </div>
                    </div>
                    {years.length > 0 && (
                        <select
                            value={selectedYearId}
                            onChange={e => setSelectedYearId(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be] w-fit"
                        >
                            {years.map(y => (
                                <option key={y.id} value={y.id}>{y.year}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Leyenda de colores */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 px-1">
                    {COLORES_DETECCION.map(c => (
                        <div key={c.hex} className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: c.hex }} />
                            <span className="text-xs text-muted-foreground">{c.label}</span>
                        </div>
                    ))}
                </div>

                <div className="rounded-lg border border-gray-200 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="border-collapse w-full" style={{ minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#192b52' }}>
                                    <th className="sticky left-0 z-20 text-left px-3 py-3 text-xs font-semibold text-white border-r"
                                        style={{ width: 240, minWidth: 240, background: '#192b52', borderColor: 'rgba(255,255,255,0.15)' }}>
                                        TEMA
                                    </th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-white border-r"
                                        style={{ width: 130, minWidth: 130, borderColor: 'rgba(255,255,255,0.15)' }}>
                                        DIRIGIDO A
                                    </th>
                                    {MONTHS.map(m => (
                                        <th key={m} className="text-center px-0 py-3 text-xs font-semibold text-white border-r"
                                            style={{ width: 44, minWidth: 44, borderColor: 'rgba(255,255,255,0.15)' }}>
                                            {m}
                                        </th>
                                    ))}
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-white"
                                        style={{ width: 180, minWidth: 180 }}>
                                        COMENTARIO
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={TOTAL_COLS} className="text-center py-16 text-muted-foreground text-sm">Cargando...</td></tr>
                                ) : isEmpty ? (
                                    <tr><td colSpan={TOTAL_COLS} className="text-center py-16 text-muted-foreground text-sm">No hay datos para {selectedYear?.year}</td></tr>
                                ) : (
                                    <>
                                        {courses.map((course, i) => {
                                            const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                                            return (
                                                <tr key={course.id} style={{ background: rowBg }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                                                    <td className="sticky left-0 z-10 px-3 py-2 border-r border-b border-gray-100 text-sm"
                                                        style={{ width: 240, minWidth: 240, background: 'inherit' }}>
                                                        <Link href={`/course/${course.id}`}
                                                            className="text-[#2166be] hover:text-[#1a5299] hover:underline font-medium leading-snug">
                                                            {course.name}
                                                        </Link>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-b border-gray-100 text-xs text-muted-foreground" style={{ width: 130 }} />
                                                    {MONTHS.map((_, mi) => {
                                                        const color = getCourseCellColor(course, mi, selectedYear?.year ?? 0);
                                                        return (
                                                            <td key={mi} className="border-r border-b border-gray-100"
                                                                style={{ width: 44, minWidth: 44, padding: '6px 4px' }}>
                                                                {color && <div className="mx-auto rounded-sm" style={{ background: color, width: 30, height: 20 }} />}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-1 border-b border-gray-100" style={{ width: 180 }}>
                                                        <input
                                                            type="text"
                                                            value={comments[course.id] ?? ''}
                                                            onChange={e => setComments(prev => ({ ...prev, [course.id]: e.target.value }))}
                                                            onBlur={() => handleCommentBlur(course.id)}
                                                            placeholder="—"
                                                            className="w-full text-sm bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[#2166be] rounded px-1 py-0.5 placeholder:text-gray-300 transition-all"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {hasDets && (
                                            <tr>
                                                <td colSpan={TOTAL_COLS}
                                                    style={{ background: '#374151', color: 'white', fontWeight: 700, padding: '6px 12px', fontSize: '11px', letterSpacing: '0.05em' }}>
                                                    DETECCIONES
                                                </td>
                                            </tr>
                                        )}

                                        {detecciones.map((det, i) => {
                                            const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                                            const statusCfg = det.status ? STATUS_CONFIG[det.status] : null;
                                            return (
                                                <tr key={det.id} style={{ background: rowBg }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                                                    <td className="sticky left-0 z-10 px-3 py-2 border-r border-b border-gray-100 text-sm"
                                                        style={{ width: 240, minWidth: 240, background: 'inherit' }}>
                                                        <div className="flex items-start gap-2">
                                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: det.color }} />
                                                            <div>
                                                                <span className="font-medium leading-snug block">{det.nombre}</span>
                                                                {(() => {
                                                                    const col = COLORES_DETECCION.find(c => c.hex === det.color);
                                                                    return col ? (
                                                                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full text-white mt-0.5" style={{ background: det.color }}>
                                                                            {col.label}
                                                                        </span>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-b border-gray-100 text-xs text-muted-foreground" style={{ width: 130 }}>
                                                        {det.departamentos || '—'}
                                                    </td>
                                                    {MONTHS.map((_, mi) => {
                                                        const color = getDetCellColor(det, mi, selectedYear?.year ?? 0);
                                                        return (
                                                            <td key={mi} className="border-r border-b border-gray-100"
                                                                style={{ width: 44, minWidth: 44, padding: '6px 4px' }}>
                                                                {color && <div className="mx-auto rounded-sm" style={{ background: color, width: 30, height: 20 }} />}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-2 border-b border-gray-100 text-xs" style={{ width: 180 }}>
                                                        {statusCfg ? (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg}`}>
                                                                {statusCfg.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {!isLoading && !isEmpty && (
                    <div className="flex flex-wrap items-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-4 rounded-sm" style={{ background: '#2166be' }} />
                            <span className="text-xs text-muted-foreground">Realizado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-4 rounded-sm" style={{ background: '#93c5fd' }} />
                            <span className="text-xs text-muted-foreground">Programado (curso)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-4 rounded-sm opacity-50" style={{ background: '#FFB433' }} />
                            <span className="text-xs text-muted-foreground">Programado (detección)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-4 rounded-sm" style={{ background: '#FFB433' }} />
                            <span className="text-xs text-muted-foreground">Realizado (detección)</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

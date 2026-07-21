"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, FileDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTrainingYears } from '@/hooks/use-training-years';
import { COLORES_DETECCION } from '@/lib/detecciones-utils';
import { generateCalendarioPdf, type CalendarioPdfFila } from '@/lib/calendario-pdf';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const TOTAL_COLS = 14;

const STATUS_LABELS: Record<string, string> = {
    '#22c55e': 'Tomado',
    '#ef4444': 'No tomado',
    '#FFB433': 'Reprogramado',
    '#2166be': 'Actualización',
};

const STATUS_COLORS: Record<string, string> = {
    tomado: '#22c55e',
    no_tomado: '#ef4444',
    reprogramado: '#FFB433',
    actualizacion: '#2166be',
};

type CourseRow = {
    id: string;
    name: string;
    date: string | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    comentario_dnc: string | null;
    deteccion_id: string | null;
    color: string;
    dnc_status: string | null;
    dnc_comentario: string | null;
    _type: 'course';
    _sortDate: string;
};

type DeteccionRow = {
    id: string;
    nombre: string;
    color: string;
    status: string | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    areas: string;
    comentario_dnc: string | null;
    _type: 'deteccion';
    _sortDate: string;
};

type UnifiedRow = CourseRow | DeteccionRow;

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

function getCourseCellStyle(course: CourseRow, monthIndex: number, year: number): { bg: string; tooltip: string } | null {
    const real = parseMonthYear(course.fecha_real);
    const prog = parseMonthYear(course.fecha_programada);
    const dateField = parseMonthYear(course.date);
    const col = course.color;

    if (real && real.month === monthIndex && real.year === year) {
        return { bg: col, tooltip: 'Tomado' };
    }
    if (prog && prog.month === monthIndex && prog.year === year && !course.fecha_real) {
        return { bg: hexToRgba(col, 0.40), tooltip: 'Programado' };
    }
    if (dateField && dateField.month === monthIndex && dateField.year === year && !course.fecha_programada && !course.fecha_real) {
        return { bg: hexToRgba(col, 0.40), tooltip: 'Programado' };
    }
    return null;
}

function getDetCellStyle(det: DeteccionRow, monthIndex: number, year: number): { bg: string; tooltip: string } | null {
    const real = parseMonthYear(det.fecha_real);
    const prog = parseMonthYear(det.fecha_programada);
    const col = det.color || '#2166be';

    if (real && real.month === monthIndex && real.year === year) {
        return { bg: col, tooltip: 'Realizado' };
    }
    if (prog && prog.month === monthIndex && prog.year === year && !det.fecha_real) {
        return { bg: hexToRgba(col, 0.40), tooltip: 'Programado' };
    }
    return null;
}

function getCourseDay(course: CourseRow, monthIndex: number, year: number): number | null {
  const real = parseMonthYear(course.fecha_real);
  if (real && real.month === monthIndex && real.year === year) {
    return new Date(course.fecha_real! + 'T12:00:00').getDate();
  }
  const prog = parseMonthYear(course.fecha_programada);
  if (prog && prog.month === monthIndex && prog.year === year && !course.fecha_real) {
    return new Date(course.fecha_programada! + 'T12:00:00').getDate();
  }
  const dateField = parseMonthYear(course.date);
  if (dateField && dateField.month === monthIndex && dateField.year === year && !course.fecha_programada && !course.fecha_real) {
    return new Date(course.date! + 'T12:00:00').getDate();
  }
  return null;
}

function getDetDay(det: DeteccionRow, monthIndex: number, year: number): number | null {
  const real = parseMonthYear(det.fecha_real);
  if (real && real.month === monthIndex && real.year === year) {
    return new Date(det.fecha_real! + 'T12:00:00').getDate();
  }
  const prog = parseMonthYear(det.fecha_programada);
  if (prog && prog.month === monthIndex && prog.year === year && !det.fecha_real) {
    return new Date(det.fecha_programada! + 'T12:00:00').getDate();
  }
  return null;
}


function sortKey(row: UnifiedRow): string {
    return row._sortDate || '9999-12-31';
}

export default function DncPage() {
    const { plantId, plantName } = useAuth();
    const { years, selectedYearId, setSelectedYearId, selectedYear } = useTrainingYears();

    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [detecciones, setDetecciones] = useState<DeteccionRow[]>([]);
    const [dncComments, setDncComments] = useState<Record<string, string>>({});
    const [detComments, setDetComments] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    useEffect(() => {
        if (plantId && selectedYearId) fetchData();
    }, [plantId, selectedYearId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: coursesData, error: cErr } = await supabase
                .from('courses')
                .select('id, name, date, start_date, end_date, fecha_programada, fecha_real, comentario_dnc, deteccion_id, dnc_status, dnc_comentario')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId);
            if (cErr) throw cErr;

            const today = new Date().toISOString().split('T')[0];
            const rows: CourseRow[] = (coursesData || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                date: c.date ?? null,
                fecha_programada: c.fecha_programada ?? null,
                fecha_real: c.fecha_real ?? null,
                comentario_dnc: c.comentario_dnc ?? null,
                deteccion_id: c.deteccion_id ?? null,
                dnc_status: c.dnc_status ?? null,
                dnc_comentario: c.dnc_comentario ?? null,
                color: c.dnc_status
                    ? (STATUS_COLORS[c.dnc_status] ?? '#ef4444')
                    : (c.end_date && c.end_date < today ? '#22c55e' : '#ef4444'),
                _type: 'course' as const,
                _sortDate: c.start_date || c.date || '9999-12-31',
            }));
            setCourses(rows);

            const initDncComments: Record<string, string> = {};
            rows.forEach(c => {
                initDncComments[c.id] = c.dnc_comentario || '';
            });
            setDncComments(initDncComments);

            const { data: detData } = await supabase
                .from('detecciones')
                .select('id, nombre, color, status, fecha_programada, fecha_real, comentario_dnc')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId);

            const dets: DeteccionRow[] = (detData || []).map((d: any) => ({
                id: d.id,
                nombre: d.nombre,
                color: (d.fecha_real && d.fecha_real <= today)
                    ? '#22c55e'
                    : (d.color || '#ef4444'),
                status: d.status,
                fecha_programada: d.fecha_programada,
                fecha_real: d.fecha_real,
                areas: '',
                comentario_dnc: d.comentario_dnc ?? null,
                _type: 'deteccion' as const,
                _sortDate: d.fecha_real || d.fecha_programada || '9999-12-31',
            }));
            setDetecciones(dets);

            const initDetComments: Record<string, string> = {};
            dets.forEach(d => {
                initDetComments[d.id] = d.comentario_dnc || '';
            });
            setDetComments(initDetComments);
        } catch (err) {
            console.error('Error fetching DNC data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDncCommentBlur = async (courseId: string) => {
        const value = dncComments[courseId] ?? '';
        await supabase.from('courses').update({ dnc_comentario: value.trim() || null }).eq('id', courseId);
    };

    const linkedDeteccionIds = useMemo(
        () => new Set(courses.map(c => c.deteccion_id).filter(Boolean) as string[]),
        [courses]
    );
    const visibleDetecciones = useMemo(
        () => detecciones.filter(d => !linkedDeteccionIds.has(d.id)),
        [detecciones, linkedDeteccionIds]
    );

    const unifiedRows = useMemo<UnifiedRow[]>(() => {
        const all: UnifiedRow[] = [...courses, ...visibleDetecciones];
        return all.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    }, [courses, visibleDetecciones]);

    const isEmpty = unifiedRows.length === 0;

    const LEGEND = [
        { hex: '#22c55e', label: 'Tomado' },
        { hex: '#ef4444', label: 'No tomado' },
        { hex: '#FFB433', label: 'Reprogramado' },
        { hex: '#2166be', label: 'Actualización cada 5 años o cambios de curso' },
    ];

    const handleExportPdf = async () => {
        if (!selectedYear || isEmpty) return;
        setIsPdfLoading(true);
        try {
            const filas: CalendarioPdfFila[] = unifiedRows.map(row => {
                const yr = selectedYear.year;
                if (row._type === 'course') {
                    const course = row as CourseRow;
                    return {
                        tipo: 'curso' as const,
                        nombre: course.name,
                        color: course.color,
                        comentario: dncComments[course.id] || null,
                        meses: Array.from({ length: 12 }, (_, mi) => {
                            const s = getCourseCellStyle(course, mi, yr);
                            const realMonth = parseMonthYear(course.fecha_real);
                            const isReal = s !== null && realMonth !== null && realMonth.month === mi && realMonth.year === yr;
                            return {
                                mes: mi + 1,
                                tiene_real: isReal,
                                tiene_programado: s !== null && !isReal,
                                dia: getCourseDay(course, mi, yr),
                            };
                        }),
                    };
                } else {
                    const det = row as DeteccionRow;
                    return {
                        tipo: 'deteccion' as const,
                        nombre: det.nombre,
                        color: det.color,
                        comentario: detComments[det.id] || null,
                        meses: Array.from({ length: 12 }, (_, mi) => {
                            const s = getDetCellStyle(det, mi, yr);
                            const realMonth = parseMonthYear(det.fecha_real);
                            const isReal = s !== null && realMonth !== null && realMonth.month === mi && realMonth.year === yr;
                            return {
                                mes: mi + 1,
                                tiene_real: isReal,
                                tiene_programado: s !== null && !isReal,
                                dia: getDetDay(det, mi, yr),
                            };
                        }),
                    };
                }
            });

            await generateCalendarioPdf({
                year: selectedYear.year,
                plant_name: plantName || '',
                filas,
            });
        } finally {
            setIsPdfLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 flex-shrink-0">
                            <CalendarDays className="w-6 h-6 text-[#2166be]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Calendario de Capacitación</h1>
                            <p className="text-muted-foreground text-sm">Timesheet anual de capacitaciones y detecciones</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                        <button
                            onClick={handleExportPdf}
                            disabled={isLoading || isEmpty || isPdfLoading}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-[#192b52]"
                        >
                            <FileDown className="w-4 h-4" />
                            {isPdfLoading ? 'Generando...' : 'Exportar PDF'}
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 px-1">
                    {LEGEND.map(c => (
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
                                    unifiedRows.map((row, i) => {
                                        const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                                        if (row._type === 'course') {
                                            const course = row as CourseRow;
                                            return (
                                                <tr key={`c-${course.id}`} style={{ background: rowBg }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                                                    <td className="sticky left-0 z-10 px-3 py-2 border-r border-b border-gray-100 text-sm"
                                                        style={{ width: 240, minWidth: 240, background: 'inherit' }}>
                                                        <Link href={`/course/${course.id}`}
                                                            className="text-[#2166be] hover:text-[#1a5299] hover:underline font-medium leading-snug">
                                                            {course.name}
                                                        </Link>
                                                    </td>

                                                    {MONTHS.map((_, mi) => {
                                                        const style = getCourseCellStyle(course, mi, selectedYear?.year ?? 0);
                                                        return (
                                                            <td key={mi} className="border-r border-b border-gray-100"
                                                                style={{ width: 44, minWidth: 44, padding: '6px 4px' }}
                                                                title={style?.tooltip}>
                                                                {style && (() => {
                                                                    const day = getCourseDay(course, mi, selectedYear?.year ?? 0);
                                                                    return (
                                                                        <div
                                                                            className="mx-auto rounded-sm flex items-center justify-center"
                                                                            style={{ background: style.bg, width: 30, height: 20 }}
                                                                        >
                                                                            {day !== null && (
                                                                                <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
                                                                                    {day}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-1 border-b border-gray-100" style={{ width: 180 }}>
                                                        <div className="flex flex-col gap-1">
                                                            {STATUS_LABELS[course.color] && (
                                                                <span
                                                                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white w-fit font-medium"
                                                                    style={{ background: course.color }}
                                                                >
                                                                    {STATUS_LABELS[course.color]}
                                                                </span>
                                                            )}
                                                            <input
                                                                type="text"
                                                                value={dncComments[course.id] ?? ''}
                                                                onChange={e => setDncComments(prev =>
                                                                    ({ ...prev, [course.id]: e.target.value }))}
                                                                onBlur={() => handleDncCommentBlur(course.id)}
                                                                placeholder="Comentario..."
                                                                className="w-full text-xs bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[#2166be] rounded px-1 py-0.5 placeholder:text-gray-300 transition-all"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            const det = row as DeteccionRow;
                                            return (
                                                <tr key={`d-${det.id}`} style={{ background: rowBg }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                                                    <td className="sticky left-0 z-10 px-3 py-2 border-r border-b border-gray-100 text-sm"
                                                        style={{ width: 240, minWidth: 240, background: 'inherit' }}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium leading-snug">{det.nombre}</span>
                                                        </div>
                                                    </td>

                                                    {MONTHS.map((_, mi) => {
                                                        const style = getDetCellStyle(det, mi, selectedYear?.year ?? 0);
                                                        return (
                                                            <td key={mi} className="border-r border-b border-gray-100"
                                                                style={{ width: 44, minWidth: 44, padding: '6px 4px' }}
                                                                title={style?.tooltip}>
                                                                {style && (() => {
                                                                    const day = getDetDay(det, mi, selectedYear?.year ?? 0);
                                                                    return (
                                                                        <div
                                                                            className="mx-auto rounded-sm flex items-center justify-center"
                                                                            style={{ background: style.bg, width: 30, height: 20 }}
                                                                        >
                                                                            {day !== null && (
                                                                                <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
                                                                                    {day}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-1 border-b border-gray-100"
                                                        style={{ width: 180 }}>
                                                        <div className="flex flex-col gap-1">
                                                            {STATUS_LABELS[det.color] && (
                                                                <span
                                                                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white w-fit font-medium"
                                                                    style={{ background: det.color }}
                                                                >
                                                                    {STATUS_LABELS[det.color]}
                                                                </span>
                                                            )}
                                                            <input
                                                                type="text"
                                                                value={detComments[det.id] ?? ''}
                                                                onChange={e => setDetComments(prev =>
                                                                    ({ ...prev, [det.id]: e.target.value }))}
                                                                onBlur={async () => {
                                                                    const value = detComments[det.id] ?? '';
                                                                    await supabase.from('detecciones')
                                                                        .update({ comentario_dnc: value.trim() || null })
                                                                        .eq('id', det.id);
                                                                }}
                                                                placeholder="Comentario..."
                                                                className="w-full text-xs bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[#2166be] rounded px-1 py-0.5 placeholder:text-gray-300 transition-all"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

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

const COURSE_COLOR = '#4A249D';

type CourseRow = {
    id: string;
    name: string;
    date: string | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    comentario_dnc: string | null;
    deteccion_id: string | null;
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
    departamentos: string;
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

    if (real && real.month === monthIndex && real.year === year) {
        return { bg: COURSE_COLOR, tooltip: 'Realizado' };
    }
    if (prog && prog.month === monthIndex && prog.year === year && !course.fecha_real) {
        return { bg: hexToRgba(COURSE_COLOR, 0.40), tooltip: 'Programado' };
    }
    if (dateField && dateField.month === monthIndex && dateField.year === year && !course.fecha_programada && !course.fecha_real) {
        return { bg: hexToRgba(COURSE_COLOR, 0.40), tooltip: 'Programado' };
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

function sortKey(row: UnifiedRow): string {
    return row._sortDate || '9999-12-31';
}

export default function DncPage() {
    const { plantId, plantName } = useAuth();
    const { years, selectedYearId, setSelectedYearId, selectedYear } = useTrainingYears();

    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [detecciones, setDetecciones] = useState<DeteccionRow[]>([]);
    const [comments, setComments] = useState<Record<string, string>>({});
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
                .select('id, name, date, fecha_programada, fecha_real, comentario_dnc, deteccion_id')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId);
            if (cErr) throw cErr;

            const rows: CourseRow[] = (coursesData || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                date: c.date ?? null,
                fecha_programada: c.fecha_programada ?? null,
                fecha_real: c.fecha_real ?? null,
                comentario_dnc: c.comentario_dnc ?? null,
                deteccion_id: c.deteccion_id ?? null,
                _type: 'course' as const,
                _sortDate: c.fecha_programada || c.fecha_real || c.date || '9999-12-31',
            }));
            setCourses(rows);

            const init: Record<string, string> = {};
            rows.forEach(c => { init[c.id] = c.comentario_dnc || ''; });
            setComments(init);

            const { data: detData } = await supabase
                .from('detecciones')
                .select('id, nombre, color, status, fecha_programada, fecha_real')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId);

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
                        _type: 'deteccion' as const,
                        _sortDate: d.fecha_programada || d.fecha_real || '9999-12-31',
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
        { hex: COURSE_COLOR, label: 'Curso realizado' },
        { hex: '#2166be', label: 'Actualización cada 5 años o cambios de curso' },
        { hex: '#22c55e', label: 'Curso tomado (detección)' },
        { hex: '#ef4444', label: 'No tomado (detección)' },
        { hex: '#FFB433', label: 'Reprogramado (detección)' },
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
                        color: COURSE_COLOR,
                        comentario: comments[course.id] || null,
                        meses: Array.from({ length: 12 }, (_, mi) => {
                            const s = getCourseCellStyle(course, mi, yr);
                            const realMonth = parseMonthYear(course.fecha_real);
                            const isReal = s !== null && realMonth !== null && realMonth.month === mi && realMonth.year === yr;
                            return {
                                mes: mi + 1,
                                tiene_real: isReal,
                                tiene_programado: s !== null && !isReal,
                            };
                        }),
                    };
                } else {
                    const det = row as DeteccionRow;
                    return {
                        tipo: 'deteccion' as const,
                        nombre: det.nombre,
                        color: det.color,
                        comentario: null,
                        meses: Array.from({ length: 12 }, (_, mi) => {
                            const s = getDetCellStyle(det, mi, yr);
                            const realMonth = parseMonthYear(det.fecha_real);
                            const isReal = s !== null && realMonth !== null && realMonth.month === mi && realMonth.year === yr;
                            return {
                                mes: mi + 1,
                                tiene_real: isReal,
                                tiene_programado: s !== null && !isReal,
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

                {/* Leyenda de colores */}
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
                                                        {course.deteccion_id && (
                                                            <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-[#4A249D] align-middle" title="Originado de detección" />
                                                        )}
                                                    </td>

                                                    {MONTHS.map((_, mi) => {
                                                        const style = getCourseCellStyle(course, mi, selectedYear?.year ?? 0);
                                                        return (
                                                            <td key={mi} className="border-r border-b border-gray-100"
                                                                style={{ width: 44, minWidth: 44, padding: '6px 4px' }}
                                                                title={style?.tooltip}>
                                                                {style && <div className="mx-auto rounded-sm" style={{ background: style.bg, width: 30, height: 20 }} />}
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
                                        } else {
                                            const det = row as DeteccionRow;
                                            const colorEntry = COLORES_DETECCION.find(c => c.hex === det.color);
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
                                                                {style && <div className="mx-auto rounded-sm" style={{ background: style.bg, width: 30, height: 20 }} />}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-2 border-b border-gray-100 text-xs" style={{ width: 180 }}>
                                                        {colorEntry ? (
                                                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ background: det.color }}>
                                                                {colorEntry.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
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

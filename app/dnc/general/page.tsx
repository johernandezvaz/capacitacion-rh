"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileBarChart2, Search, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTrainingYears } from '@/hooks/use-training-years';
import { fmtDate } from '@/lib/detecciones-utils';

const COURSE_COLOR = '#4A249D';

// ── Types ──────────────────────────────────────────────────────────────────────

type Empleado = { nombre: string; puesto: string };

type CourseItem = {
    _type: 'course';
    _sortDate: string;
    id: string;
    name: string;
    date: string | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    inst_interno: string | null;
    proveedor_sugerido: string | null;
    costo: number | null;
    duration_hours: number | null;
    desarrollo_personal: boolean;
    habilidades_blandas: boolean;
    prevencion_riesgos: boolean;
    habilidades_tecnicas: boolean;
    deteccion_id: string | null;
    empleados: Empleado[];
};

type DetItem = {
    _type: 'deteccion';
    _sortDate: string;
    id: string;
    nombre: string;
    color: string;
    fecha_programada: string | null;
    fecha_real: string | null;
    inst_interno: string | null;
    proveedor_sugerido: string | null;
    costo: number | null;
    duration_hours: number | null;
    desarrollo_personal: boolean;
    habilidades_blandas: boolean;
    prevencion_riesgos: boolean;
    habilidades_tecnicas: boolean;
    empleados: Empleado[];
};

type UnifiedItem = CourseItem | DetItem;

const DNC_FIELDS: { key: keyof CourseItem & keyof DetItem; label: string; bool?: boolean; date?: boolean; money?: boolean }[] = [
    { key: 'inst_interno', label: 'Inst. Interno' },
    { key: 'proveedor_sugerido', label: 'Proveedor' },
    { key: 'costo', label: 'Costo', money: true },
    { key: 'duration_hours', label: 'Duración' },
    { key: 'fecha_programada', label: 'F. Programada', date: true },
    { key: 'fecha_real', label: 'F. Real', date: true },
    { key: 'desarrollo_personal', label: 'Des. Personal', bool: true },
    { key: 'habilidades_blandas', label: 'Hab. Blandas', bool: true },
    { key: 'prevencion_riesgos', label: 'Prev. Riesgos', bool: true },
    { key: 'habilidades_tecnicas', label: 'Hab. Técnicas', bool: true },
];

function fmtField(item: UnifiedItem, col: typeof DNC_FIELDS[number]): string {
    const val = (item as any)[col.key];
    if (col.bool) return val ? '✓' : '—';
    if (col.date) return fmtDate(val);
    if (col.money) return val != null ? `$${(val as number).toLocaleString('es-MX')}` : '—';
    if (col.key === 'duration_hours') return val != null ? `${val}h` : '—';
    return val ?? '—';
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DncGeneralPage() {
    const router = useRouter();
    const { plantId } = useAuth();
    const { years, selectedYearId, setSelectedYearId } = useTrainingYears();

    const [courseItems, setCourseItems] = useState<CourseItem[]>([]);
    const [detItems, setDetItems] = useState<DetItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchName, setSearchName] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    useEffect(() => {
        if (plantId && selectedYearId) fetchData();
    }, [plantId, selectedYearId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // ── Courses ────────────────────────────────────────────────────────
            const { data: coursesRaw } = await supabase
                .from('courses')
                .select('id, name, date, fecha_programada, fecha_real, inst_interno, proveedor_sugerido, costo, duration_hours, desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas, deteccion_id')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId)
                .order('date', { ascending: true, nullsFirst: false });

            const courseIds = (coursesRaw || []).map((c: any) => c.id);

            // Participants for each course
            let partMap: Record<string, Empleado[]> = {};
            if (courseIds.length > 0) {
                const { data: partData } = await supabase
                    .from('course_participants')
                    .select('course_id, employees!employee_id(nombre, puesto)')
                    .in('course_id', courseIds);

                (partData || []).forEach((r: any) => {
                    const emp = r.employees;
                    if (!emp) return;
                    if (!partMap[r.course_id]) partMap[r.course_id] = [];
                    partMap[r.course_id].push({ nombre: emp.nombre, puesto: emp.puesto });
                });
            }

            setCourseItems((coursesRaw || []).map((c: any) => ({
                _type: 'course' as const,
                _sortDate: c.date || c.fecha_programada || c.fecha_real || '9999-12-31',
                id: c.id,
                name: c.name,
                date: c.date ?? null,
                fecha_programada: c.fecha_programada ?? null,
                fecha_real: c.fecha_real ?? null,
                inst_interno: c.inst_interno ?? null,
                proveedor_sugerido: c.proveedor_sugerido ?? null,
                costo: c.costo ?? null,
                duration_hours: c.duration_hours ?? null,
                desarrollo_personal: c.desarrollo_personal ?? false,
                habilidades_blandas: c.habilidades_blandas ?? false,
                prevencion_riesgos: c.prevencion_riesgos ?? false,
                habilidades_tecnicas: c.habilidades_tecnicas ?? false,
                deteccion_id: c.deteccion_id ?? null,
                empleados: partMap[c.id] || [],
            })));

            // ── Detecciones (excluding those with a linked course) ─────────────
            const linkedIds = (coursesRaw || [])
                .map((c: any) => c.deteccion_id)
                .filter(Boolean) as string[];

            let detQuery = supabase
                .from('detecciones')
                .select('id, nombre, color, fecha_programada, fecha_real, inst_interno, proveedor_sugerido, costo, duration_hours, desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId)
                .order('fecha_programada', { ascending: true, nullsFirst: false });

            if (linkedIds.length > 0) {
                detQuery = detQuery.not('id', 'in', `(${linkedIds.join(',')})`);
            }

            const { data: detsRaw } = await detQuery;

            let empMap: Record<string, Empleado[]> = {};
            if (detsRaw && detsRaw.length > 0) {
                const detIds = detsRaw.map((d: any) => d.id);
                const { data: empData } = await supabase
                    .from('deteccion_empleados')
                    .select('deteccion_id, employees!employee_id(nombre, puesto)')
                    .in('deteccion_id', detIds);

                (empData || []).forEach((r: any) => {
                    const emp = r.employees;
                    if (!emp) return;
                    if (!empMap[r.deteccion_id]) empMap[r.deteccion_id] = [];
                    empMap[r.deteccion_id].push({ nombre: emp.nombre, puesto: emp.puesto });
                });
            }

            setDetItems((detsRaw || []).map((d: any) => ({
                _type: 'deteccion' as const,
                _sortDate: d.fecha_programada || d.fecha_real || '9999-12-31',
                id: d.id,
                nombre: d.nombre,
                color: d.color || '#2166be',
                fecha_programada: d.fecha_programada ?? null,
                fecha_real: d.fecha_real ?? null,
                inst_interno: d.inst_interno ?? null,
                proveedor_sugerido: d.proveedor_sugerido ?? null,
                costo: d.costo ?? null,
                duration_hours: d.duration_hours ?? null,
                desarrollo_personal: d.desarrollo_personal ?? false,
                habilidades_blandas: d.habilidades_blandas ?? false,
                prevencion_riesgos: d.prevencion_riesgos ?? false,
                habilidades_tecnicas: d.habilidades_tecnicas ?? false,
                empleados: empMap[d.id] || [],
            })));
        } catch (err) {
            console.error('Error fetching DNC general:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Group by month from fecha_programada, respecting sort direction
    const groupedItems = useMemo(() => {
        const q = searchName.toLowerCase();
        const all: UnifiedItem[] = [...courseItems, ...detItems];

        const filtered = q
            ? all.filter(item =>
                item._type === 'course'
                    ? item.name.toLowerCase().includes(q)
                    : item.nombre.toLowerCase().includes(q)
              )
            : all;

        const groups: Record<string, { label: string; sortKey: string; items: UnifiedItem[] }> = {};
        const noDate: UnifiedItem[] = [];

        filtered.forEach(item => {
            // Use date (courses) or fecha_programada (detecciones) as the grouping key
            // — same logic as year/[id]/page.tsx
            const dateStr = item._type === 'course'
                ? (item as CourseItem).date || item.fecha_programada || item.fecha_real
                : item.fecha_programada || item.fecha_real;
            if (!dateStr) {
                noDate.push(item);
                return;
            }
            const d = new Date(dateStr + 'T12:00:00');
            const month = d.toLocaleString('es-ES', { month: 'long' });
            const yr = d.getFullYear();
            const label = `${month.charAt(0).toUpperCase() + month.slice(1)} ${yr}`;
            const key = `${yr}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[key]) groups[key] = { label, sortKey: key, items: [] };
            groups[key].items.push(item);
        });

        const sorted = Object.values(groups).sort((a, b) =>
            sortAsc ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey)
        );

        // Sort items within each group by their date
        sorted.forEach(g => {
            g.items.sort((a, b) =>
                sortAsc
                    ? a._sortDate.localeCompare(b._sortDate)
                    : b._sortDate.localeCompare(a._sortDate)
            );
        });

        if (noDate.length > 0) {
            sorted.push({ label: 'Sin fecha', sortKey: sortAsc ? '9999-99' : '0000-00', items: noDate });
        }

        return sorted;
    }, [courseItems, detItems, searchName, sortAsc]);

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 flex-shrink-0">
                            <FileBarChart2 className="w-6 h-6 text-[#2166be]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">DNC General</h1>
                            <p className="text-muted-foreground text-sm">Vista unificada de cursos y detecciones del año</p>
                        </div>
                    </div>
                    {years.length > 0 && (
                        <select
                            value={selectedYearId}
                            onChange={e => setSelectedYearId(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be] w-fit"
                        >
                            {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
                        </select>
                    )}
                </div>

                {/* Search + sort */}
                <Card className="border-none shadow-md mb-6">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre..."
                                    value={searchName}
                                    onChange={e => setSearchName(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <button
                                onClick={() => setSortAsc(prev => !prev)}
                                title={sortAsc ? 'Orden ascendente — clic para invertir' : 'Orden descendente — clic para invertir'}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-[#192b52] font-medium transition-colors whitespace-nowrap"
                            >
                                {sortAsc
                                    ? <><ArrowUp className="w-4 h-4" /> Fecha ASC</>
                                    : <><ArrowDown className="w-4 h-4" /> Fecha DESC</>}
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* Unified month-grouped list */}
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-lg" />)}
                    </div>
                ) : groupedItems.length === 0 ? (
                    <Card className="border-none shadow-md">
                        <CardContent className="py-16 text-center">
                            <FileBarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                            <p className="text-muted-foreground text-sm">
                                {searchName ? 'Sin resultados para la búsqueda' : 'No hay datos para este año'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {groupedItems.map(group => (
                            <div key={group.sortKey} className="space-y-3">
                                {/* Month header */}
                                <h2 className="text-base font-semibold text-[#192b52] border-b border-gray-200 pb-2">
                                    {group.label}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">({group.items.length})</span>
                                </h2>
                                <div className="space-y-3">
                                    {group.items.map(item => {
                            const isCourse = item._type === 'course';
                            const dotColor = isCourse ? COURSE_COLOR : (item as DetItem).color;
                            const displayName = isCourse ? (item as CourseItem).name : (item as DetItem).nombre;
                            const href = isCourse
                                ? `/course/${item.id}/dnc`
                                : `/detecciones/${item.id}`;

                            return (
                                <div key={`${item._type}-${item.id}`} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    {/* Header row */}
                                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b">
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <span
                                                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                                style={{ background: dotColor }}
                                            />
                                            <span className="font-semibold text-sm text-[#192b52] truncate">
                                                {displayName}
                                            </span>
                                            {isCourse && (item as CourseItem).deteccion_id && (
                                                <span
                                                    className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                                                    style={{ background: COURSE_COLOR }}
                                                    title="Promovido desde detección"
                                                >
                                                    Detección
                                                </span>
                                            )}
                                            <Badge variant="secondary" className="flex-shrink-0 text-[10px]">
                                                {isCourse ? 'Curso' : 'Detección'}
                                            </Badge>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white flex-shrink-0"
                                            onClick={() => router.push(href)}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                            Ver
                                        </Button>
                                    </div>

                                    {/* DNC fields */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-4 py-3 text-xs border-b">
                                        {DNC_FIELDS.map(col => {
                                            const val = fmtField(item, col);
                                            const isBool = col.bool;
                                            return (
                                                <div key={col.key}>
                                                    <span className="text-muted-foreground">{col.label}:</span>
                                                    <br />
                                                    <span className={`font-medium ${isBool && val === '✓' ? 'text-green-600' : isBool ? 'text-muted-foreground' : ''}`}>
                                                        {val}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Employees / participants */}
                                    {item.empleados.length > 0 && (
                                        <div className="px-4 py-3">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                                                {isCourse ? 'PARTICIPANTES' : 'EMPLEADOS'} ({item.empleados.length})
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {item.empleados.map((emp, ei) => (
                                                    <div key={ei} className="bg-blue-50 border border-blue-100 rounded-md px-2 py-1 text-xs">
                                                        <span className="font-medium text-[#192b52]">{emp.nombre}</span>
                                                        <span className="text-muted-foreground ml-1">· {emp.puesto}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

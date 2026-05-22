"use client";
import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, FileDown, ClipboardCheck, PencilLine, Trash2, UserMinus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useTrainingYears } from '@/hooks/use-training-years';
import { STATUS_CONFIG, fmtDate, COLORES_DETECCION } from '@/lib/detecciones-utils';
import { DeteccionFormModal } from '@/components/deteccion-form-modal';
import { EstadoIndividualModal } from '@/components/estado-individual-modal';
import { generateDeteccionesPdf } from '@/lib/detecciones-pdf';

export { STATUS_CONFIG, fmtDate } from '@/lib/detecciones-utils';
export type { DeteccionStatus } from '@/lib/detecciones-utils';
export { StatusCombo } from '@/lib/detecciones-utils';

type DetRow = {
    id: string; nombre: string; color: string; status: string | null;
    inst_interno: string | null; inst_externo: string | null; proveedor_sugerido: string | null; costo: number | null;
    desarrollo_personal: boolean; habilidades_blandas: boolean;
    prevencion_riesgos: boolean; habilidades_tecnicas: boolean;
    fecha_programada: string | null; fecha_real: string | null; duration_hours: number | null;
    dept_ids: string[]; emp_ids: string[];
    emp_color: string | null;
    emp_status: string | null;
    _emp_key: string;
};

type EmpGroup = { id: string; nombre: string; puesto: string; detecciones: DetRow[] };
type AreaGroup = { area: string; empleados: EmpGroup[] };

const CB_COLS = [
    { key: 'inst_interno', label: 'Inst. Int.' },
    { key: 'inst_externo', label: 'Inst. Ext.' },
    { key: 'proveedor_sugerido', label: 'Proveedor' },
    { key: 'costo', label: 'Costo' },
    { key: 'desarrollo_personal', label: 'Des.P', bool: true },
    { key: 'habilidades_blandas', label: 'Hab.B', bool: true },
    { key: 'prevencion_riesgos', label: 'Prev.R', bool: true },
    { key: 'habilidades_tecnicas', label: 'Hab.T', bool: true },
    { key: 'fecha_programada', label: 'F.Prog', date: true },
    { key: 'fecha_real', label: 'F.Real', date: true },
    { key: 'duration_hours', label: 'Hrs' },
] as const;

function getRowColor(hex: string) {
    const map: Record<string, { bg: string; text: string }> = {
        '#22c55e': { bg: '#408A71', text: '#091413' },
        '#ef4444': { bg: '#F05454', text: '#121212' },
        '#FFB433': { bg: '#FFC947', text: '#0A1931' },
        '#2166be': { bg: '#1D546D', text: '#F3F4F4' },
    };
    return map[hex] ?? { bg: '#ffffff', text: '#000000' };
}

export default function DeteccionesPage() {
    const { plantId, plantName } = useAuth();
    const { toast } = useToast();
    const { years, selectedYearId, setSelectedYearId, selectedYear } = useTrainingYears();

    const [groups, setGroups] = useState<AreaGroup[]>([]);
    const [rawDets, setRawDets] = useState<DetRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterArea, setFilterArea] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<any>(null);
    const [estadoModal, setEstadoModal] = useState<{
        open: boolean;
        deteccionId: string;
        deteccionNombre: string;
        empleadoId: string;
        empleadoNombre: string;
        currentColor: string;
        empKey: string;
    }>({
        open: false, deteccionId: '', deteccionNombre: '',
        empleadoId: '', empleadoNombre: '', currentColor: '', empKey: '',
    });

    useEffect(() => { if (plantId && selectedYearId) fetchData(); }, [plantId, selectedYearId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: detData } = await supabase.from('detecciones').select('*')
                .eq('plant_id', plantId).eq('year_id', selectedYearId);
            if (!detData || detData.length === 0) { setGroups([]); setRawDets([]); setIsLoading(false); return; }

            const ids = detData.map((d: any) => d.id);

            const { data: empLinks } = await supabase
                .from('deteccion_empleados')
                .select(`
                    deteccion_id, employee_id, color, status,
                    employees!employee_id(id, nombre, puesto, area)
                `)
                .in('deteccion_id', ids);

            const empsByDet: Record<string, string[]> = {};
            (empLinks || []).forEach((r: any) => {
                if (!empsByDet[r.deteccion_id]) empsByDet[r.deteccion_id] = [];
                empsByDet[r.deteccion_id].push(r.employee_id);
            });

            const dets: DetRow[] = detData.map((d: any) => ({
                ...d,
                dept_ids: [],
                emp_ids: empsByDet[d.id] || [],
                emp_color: null,
                emp_status: null,
                _emp_key: '',
            }));
            setRawDets(dets);

            const indivMap: Record<string, { color: string | null; status: string | null }> = {};
            (empLinks || []).forEach((r: any) => {
                indivMap[`${r.employee_id}__${r.deteccion_id}`] = {
                    color: r.color ?? null,
                    status: r.status ?? null,
                };
            });

            const empDetMap: Record<string, DetRow[]> = {};
            (empLinks || []).forEach((r: any) => {
                const baseDet = dets.find(d => d.id === r.deteccion_id);
                if (!baseDet) return;
                const key = `${r.employee_id}__${r.deteccion_id}`;
                const indiv = indivMap[key] ?? { color: null, status: null };
                const detWithIndiv: DetRow = {
                    ...baseDet,
                    emp_color: indiv.color,
                    emp_status: indiv.status,
                    _emp_key: key,
                };
                if (!empDetMap[r.employee_id]) empDetMap[r.employee_id] = [];
                if (!empDetMap[r.employee_id].find(d => d._emp_key === key))
                    empDetMap[r.employee_id].push(detWithIndiv);
            });

            const areaGroupMap: Record<string, AreaGroup> = {};

            const processedEmps = new Set<string>();
            (empLinks || []).forEach((r: any) => {
                const emp = r.employees;
                if (!emp || processedEmps.has(emp.id)) return;
                processedEmps.add(emp.id);

                const area: string = emp.area || 'Sin Área';
                const empGroup: EmpGroup = {
                    id: emp.id, nombre: emp.nombre, puesto: emp.puesto,
                    detecciones: empDetMap[emp.id] || [],
                };

                if (!areaGroupMap[area]) {
                    areaGroupMap[area] = { area, empleados: [] };
                }
                areaGroupMap[area].empleados.push(empGroup);
            });

            const sorted = Object.values(areaGroupMap).sort((a, b) => a.area.localeCompare(b.area));
            setGroups(sorted);
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    const [confirmDeleteDet, setConfirmDeleteDet] = useState<string | null>(null);
    const [confirmRemoveEmp, setConfirmRemoveEmp] = useState<{ detId: string; empId: string; empKey: string } | null>(null);

    const handleDeleteDeteccion = async (detId: string) => {
        try {
            await supabase.from('deteccion_empleados').delete().eq('deteccion_id', detId);
            await supabase.from('detecciones').delete().eq('id', detId);
            setConfirmDeleteDet(null);
            toast({ title: 'Detección eliminada' });
            fetchData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'No se pudo eliminar', variant: 'destructive' });
        }
    };

    const handleRemoveEmpleado = async (detId: string, empId: string, empKey: string) => {
        try {
            await supabase.from('deteccion_empleados').delete().eq('deteccion_id', detId).eq('employee_id', empId);
            setConfirmRemoveEmp(null);
            setGroups(prev =>
                prev.map(grp => ({
                    ...grp,
                    empleados: grp.empleados
                        .map(emp => ({ ...emp, detecciones: emp.detecciones.filter(d => d._emp_key !== empKey) }))
                        .filter(emp => emp.detecciones.length > 0),
                })).filter(grp => grp.empleados.length > 0)
            );
            toast({ title: 'Empleado quitado de la detección' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'No se pudo quitar', variant: 'destructive' });
        }
    };

    const openCreate = () => { setEditingId(null); setEditingData(null); setModalOpen(true); };
    const openEdit = (det: DetRow) => { setEditingId(det.id); setEditingData(det); setModalOpen(true); };

    const openEstadoIndividual = (emp: EmpGroup, det: DetRow) => {
        const colorActivo = det.emp_color ?? det.color;
        setEstadoModal({
            open: true,
            deteccionId: det.id,
            deteccionNombre: det.nombre,
            empleadoId: emp.id,
            empleadoNombre: emp.nombre,
            currentColor: colorActivo,
            empKey: det._emp_key,
        });
    };

    const handleEstadoSaved = (color: string, status: string) => {
        const { empKey } = estadoModal;
        setGroups(prev => prev.map(grp => ({
            ...grp,
            empleados: grp.empleados.map(emp => ({
                ...emp,
                detecciones: emp.detecciones.map(det =>
                    det._emp_key === empKey
                        ? { ...det, emp_color: color, emp_status: status }
                        : det
                ),
            })),
        })));
    };

    const filteredGroups = useMemo(() =>
        filterArea ? groups.filter(g => g.area === filterArea) : groups,
        [groups, filterArea]);

    const handleExportAreaPdf = async (grp: AreaGroup) => {
        if (!selectedYear) return;
        const pdfArea = {
            area: grp.area,
            empleados: grp.empleados.map(emp => ({
                nombre: emp.nombre, puesto: emp.puesto,
                detecciones: emp.detecciones.map(d => ({
                    nombre: d.nombre,
                    color: d.emp_color ?? d.color,
                    status: d.emp_status ?? d.status,
                    inst_interno: d.inst_interno, inst_externo: d.inst_externo, proveedor_sugerido: d.proveedor_sugerido,
                    costo: d.costo, desarrollo_personal: d.desarrollo_personal,
                    habilidades_blandas: d.habilidades_blandas, prevencion_riesgos: d.prevencion_riesgos,
                    habilidades_tecnicas: d.habilidades_tecnicas, fecha_programada: d.fecha_programada,
                    fecha_real: d.fecha_real, duration_hours: d.duration_hours,
                })),
            })),
        };
        await generateDeteccionesPdf({
            year: selectedYear.year,
            plant_name: plantName || '',
            areas: [pdfArea],
            codigo_area: grp.area,
        });
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                            <ClipboardCheck className="w-5 h-5 text-[#2166be]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">Detecciones</h1>
                            <p className="text-muted-foreground text-sm">Necesidades de capacitación por área</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {years.length > 0 && (
                            <select value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be]">
                                {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
                            </select>
                        )}
                        {groups.length > 0 && (
                            <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be]">
                                <option value="">Todas las áreas</option>
                                {groups.map(g => <option key={g.area} value={g.area}>{g.area}</option>)}
                            </select>
                        )}
                        <Button onClick={openCreate} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
                            <Plus className="w-4 h-4 mr-1" />Nueva Detección
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-lg" />)}</div>
                ) : filteredGroups.length === 0 ? (
                    <Card className="border-none shadow-lg">
                        <CardContent className="py-16 text-center">
                            <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                            <p className="text-muted-foreground text-sm">No hay detecciones para {selectedYear?.year}</p>
                            <Button onClick={openCreate} className="mt-4 bg-[#2166be] hover:bg-[#1a5299] text-white">
                                <Plus className="w-4 h-4 mr-1" />Nueva Detección
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {filteredGroups.map(grp => (
                            <div key={grp.area}>
                                <div className="rounded-t-lg px-4 py-2.5 flex items-center justify-between" style={{ background: '#192b52' }}>
                                    <span className="font-bold text-sm text-white">{grp.area}</span>
                                    <button
                                        onClick={() => handleExportAreaPdf(grp)}
                                        className="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded px-2.5 py-1 transition-colors"
                                        title={`Exportar PDF — ${grp.area}`}
                                    >
                                        <FileDown className="w-3.5 h-3.5" />
                                        Exportar PDF — {grp.area}
                                    </button>
                                </div>
                                <div className="space-y-4 border border-t-0 rounded-b-lg overflow-hidden bg-white">
                                    {grp.empleados.map((emp, empIdx) => (
                                        <div key={emp.id}>
                                            <div className="px-4 py-2 text-sm font-semibold text-white flex items-center gap-3" style={{ background: empIdx % 2 === 0 ? '#0833a2' : '#0833a2' }}>
                                                <span>{emp.nombre}</span>
                                                <span className="font-normal opacity-75">· {emp.puesto}</span>
                                            </div>

                                            {emp.detecciones.map((det, di) => {
                                                const colorActivo = det.emp_color ?? det.color;
                                                const statusActivo = det.emp_status ?? det.status;
                                                const col = COLORES_DETECCION.find(c => c.hex === colorActivo);
                                                const sc = statusActivo ? STATUS_CONFIG[statusActivo] : null;

                                                return (
                                                    <div key={det._emp_key || det.id}>
                                                        <div className="px-4 py-1.5 flex items-center justify-between" style={{ background: '#4b5563' }}>
                                                            <div className="flex items-center gap-2">
                                                                {col && (
                                                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ background: colorActivo }} />
                                                                )}
                                                                <span className="text-xs font-semibold text-white">{det.nombre}</span>
                                                                {col && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white/90 font-medium" style={{ background: `${colorActivo}99` }}>
                                                                        {col.label}
                                                                    </span>
                                                                )}
                                                                {sc && <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${sc.bg}`}>{sc.label}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="sm" variant="ghost"
                                                                    className="h-6 px-2 text-white/70 hover:text-white hover:bg-white/10 text-[10px] flex items-center gap-1"
                                                                    title="Editar detección completa"
                                                                    onClick={() => { setConfirmDeleteDet(null); setConfirmRemoveEmp(null); openEdit(det); }}
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                    Editar
                                                                </Button>

                                                                {/* Quitar empleado de esta detección */}
                                                                {confirmRemoveEmp?.empKey === det._emp_key ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            className="h-6 px-2 text-[10px] rounded bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                                                                            onClick={() => handleRemoveEmpleado(det.id, emp.id, det._emp_key)}
                                                                        >¿Quitar?</button>
                                                                        <button
                                                                            className="h-6 px-2 text-[10px] rounded bg-white/20 hover:bg-white/30 text-white"
                                                                            onClick={() => setConfirmRemoveEmp(null)}
                                                                        >Cancelar</button>
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        size="sm" variant="ghost"
                                                                        className="h-6 px-2 text-white/70 hover:text-orange-300 hover:bg-white/10 text-[10px] flex items-center gap-1"
                                                                        title={`Quitar ${emp.nombre} de esta detección`}
                                                                        onClick={() => { setConfirmDeleteDet(null); setConfirmRemoveEmp({ detId: det.id, empId: emp.id, empKey: det._emp_key }); }}
                                                                    >
                                                                        <UserMinus className="w-3 h-3" />
                                                                        Quitar empleado
                                                                    </Button>
                                                                )}

                                                                {/* Eliminar detección completa */}
                                                                {confirmDeleteDet === det.id ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            className="h-6 px-2 text-[10px] rounded bg-red-500 hover:bg-red-600 text-white font-semibold"
                                                                            onClick={() => handleDeleteDeteccion(det.id)}
                                                                        >¿Eliminar?</button>
                                                                        <button
                                                                            className="h-6 px-2 text-[10px] rounded bg-white/20 hover:bg-white/30 text-white"
                                                                            onClick={() => setConfirmDeleteDet(null)}
                                                                        >Cancelar</button>
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        size="sm" variant="ghost"
                                                                        className="h-6 px-2 text-white/70 hover:text-red-300 hover:bg-white/10 text-[10px] flex items-center gap-1"
                                                                        title="Eliminar detección completa"
                                                                        onClick={() => { setConfirmRemoveEmp(null); setConfirmDeleteDet(det.id); }}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                        Eliminar
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="border-b bg-slate-50">
                                                                        {CB_COLS.map(c => (
                                                                            <th key={c.key} className="text-center py-2 px-2 font-semibold text-[#192b52] whitespace-nowrap">{c.label}</th>
                                                                        ))}
                                                                        <th className="text-right py-2 px-3 font-semibold text-[#192b52]">Estado</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(() => {
                                                                        const emp_color = det.emp_color ?? det.color;
                                                                        const rowColor = getRowColor(emp_color);
                                                                        return (
                                                                            <tr style={{ background: rowColor.bg, color: rowColor.text, fontWeight: 'bold' }}>
                                                                                <td className="py-2 px-2 text-center">{det.inst_interno || '—'}</td>
                                                                                <td className="py-2 px-2 text-center">{det.inst_externo || '—'}</td>
                                                                                <td className="py-2 px-2 text-center">{det.proveedor_sugerido || '—'}</td>
                                                                                <td className="py-2 px-2 text-center">{det.costo != null ? `$${det.costo}` : '—'}</td>
                                                                                {(['desarrollo_personal', 'habilidades_blandas', 'prevencion_riesgos', 'habilidades_tecnicas'] as const).map(k => (
                                                                                    <td key={k} className={`py-2 px-2 text-center font-semibold ${det[k] ? 'text-green-600' : 'opacity-60'}`}>
                                                                                        {det[k] ? '✓' : '—'}
                                                                                    </td>
                                                                                ))}
                                                                                <td className="py-2 px-2 text-center">{fmtDate(det.fecha_programada)}</td>
                                                                                <td className="py-2 px-2 text-center">{fmtDate(det.fecha_real)}</td>
                                                                                <td className="py-2 px-2 text-center">{det.duration_hours != null ? `${det.duration_hours}h` : '—'}</td>
                                                                                <td className="py-2 px-3 text-right">
                                                                                    <Button
                                                                                        size="sm" variant="ghost"
                                                                                        className="h-7 px-2 hover:bg-black/10"
                                                                                        style={{ color: rowColor.text }}
                                                                                        title={`Estado de ${emp.nombre} — ${det.nombre}`}
                                                                                        onClick={() => openEstadoIndividual(emp, det)}
                                                                                    >
                                                                                        <PencilLine className="w-3.5 h-3.5" />
                                                                                    </Button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })()}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DeteccionFormModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                onSaved={fetchData}
                plantId={plantId || ''}
                yearId={selectedYearId}
                editingId={editingId}
                editingData={editingData}
            />

            <EstadoIndividualModal
                open={estadoModal.open}
                onOpenChange={v => setEstadoModal(prev => ({ ...prev, open: v }))}
                deteccionId={estadoModal.deteccionId}
                deteccionNombre={estadoModal.deteccionNombre}
                empleadoId={estadoModal.empleadoId}
                empleadoNombre={estadoModal.empleadoNombre}
                currentColor={estadoModal.currentColor}
                onSaved={handleEstadoSaved}
            />
        </div>
    );
}

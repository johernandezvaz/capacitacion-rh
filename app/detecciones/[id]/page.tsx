"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, UserPlus, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { STATUS_CONFIG, fmtDate, StatusCombo, DeteccionStatus } from '../page';

type Deteccion = {
    id: string; nombre: string; status: DeteccionStatus;
    inst_interno: string | null; proveedor_sugerido: string | null; costo: number | null;
    fecha_programada: string | null; fecha_real: string | null; duration_hours: number | null;
    desarrollo_personal: boolean; habilidades_blandas: boolean;
    prevencion_riesgos: boolean; habilidades_tecnicas: boolean; comentario_dnc: string | null;
};

type AssignedEmployee = { id: string; nombre: string; puesto: string; departamento: string | null; };
type EmployeeOption   = { id: string; nombre: string; puesto: string; departamento: string | null; };

const CHECKBOX_FIELDS = [
    { key: 'desarrollo_personal' as const,  label: 'Desarrollo Personal y Académico' },
    { key: 'habilidades_blandas' as const,  label: 'Habilidades Blandas' },
    { key: 'prevencion_riesgos' as const,   label: 'Prevención de Riesgos y Accidentes' },
    { key: 'habilidades_tecnicas' as const, label: 'Habilidades Técnicas' },
];

export default function DeteccionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { toast } = useToast();

    const [deteccion, setDeteccion] = useState<Deteccion | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [form, setForm] = useState({
        nombre: '', inst_interno: '', proveedor_sugerido: '', costo: '',
        fecha_programada: '', fecha_real: '', duration_hours: '',
        desarrollo_personal: false, habilidades_blandas: false,
        prevencion_riesgos: false, habilidades_tecnicas: false,
        comentario_dnc: '', status: '' as string,
    });

    const [assigned, setAssigned] = useState<AssignedEmployee[]>([]);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
    const [empSearch, setEmpSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isAssigning, setIsAssigning] = useState(false);

    const fetchDeteccion = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('detecciones').select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            if (!data) { router.push('/detecciones'); return; }
            setDeteccion(data);
            setForm({
                nombre: data.nombre,
                inst_interno: data.inst_interno || '',
                proveedor_sugerido: data.proveedor_sugerido || '',
                costo: data.costo != null ? String(data.costo) : '',
                fecha_programada: data.fecha_programada || '',
                fecha_real: data.fecha_real || '',
                duration_hours: data.duration_hours != null ? String(data.duration_hours) : '',
                desarrollo_personal: data.desarrollo_personal,
                habilidades_blandas: data.habilidades_blandas,
                prevencion_riesgos: data.prevencion_riesgos,
                habilidades_tecnicas: data.habilidades_tecnicas,
                comentario_dnc: data.comentario_dnc || '',
                status: data.status || '',
            });
        } catch (err: any) {
            toast({ title: 'Error', description: 'No se pudo cargar la detección', variant: 'destructive' });
        } finally { setIsLoading(false); }
    };

    const fetchAssigned = async () => {
        const { data, error } = await supabase
            .from('deteccion_empleados')
            .select('employees!employee_id(id, nombre, puesto, departamento)')
            .eq('deteccion_id', id)
            .order('employees(nombre)', { ascending: true });
        if (!error) setAssigned((data || []).map((r: any) => r.employees).filter(Boolean).sort((a: AssignedEmployee, b: AssignedEmployee) => a.nombre.localeCompare(b.nombre)));
    };

    useEffect(() => { fetchDeteccion(); fetchAssigned(); }, [id]);

    const handleSave = async () => {
        if (!form.nombre.trim()) { toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' }); return; }
        setIsSaving(true);
        try {
            const { error } = await supabase.from('detecciones').update({
                nombre: form.nombre.trim(),
                inst_interno: form.inst_interno.trim() || null,
                proveedor_sugerido: form.proveedor_sugerido.trim() || null,
                costo: form.costo ? parseFloat(form.costo) : null,
                fecha_programada: form.fecha_programada || null,
                fecha_real: form.fecha_real || null,
                duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : null,
                desarrollo_personal: form.desarrollo_personal,
                habilidades_blandas: form.habilidades_blandas,
                prevencion_riesgos: form.prevencion_riesgos,
                habilidades_tecnicas: form.habilidades_tecnicas,
                comentario_dnc: form.comentario_dnc.trim() || null,
                status: form.status || null,
            }).eq('id', id);
            if (error) throw error;
            setDeteccion(prev => prev ? { ...prev, nombre: form.nombre.trim(), status: (form.status || null) as DeteccionStatus } : null);
            toast({ title: 'Éxito', description: 'Cambios guardados' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
        } finally { setIsSaving(false); }
    };

    const openAssign = async () => {
        const assignedIds = new Set(assigned.map(e => e.id));
        const { data } = await supabase.from('employees').select('id, nombre, puesto, departamento').order('nombre', { ascending: true });
        setAllEmployees((data || []).filter((e: any) => !assignedIds.has(e.id)));
        setSelected(new Set());
        setEmpSearch('');
        setIsAssignOpen(true);
    };

    const handleAssign = async () => {
        if (selected.size === 0) return;
        setIsAssigning(true);
        try {
            const rows = Array.from(selected).map(empId => ({ deteccion_id: id, employee_id: empId }));
            const { error } = await supabase.from('deteccion_empleados').insert(rows);
            if (error) throw error;
            await fetchAssigned();
            setIsAssignOpen(false);
            toast({ title: 'Éxito', description: `${rows.length} empleado(s) asignado(s)` });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'No se pudo asignar', variant: 'destructive' });
        } finally { setIsAssigning(false); }
    };

    const handleRemove = async (empId: string) => {
        const { error } = await supabase.from('deteccion_empleados').delete().eq('deteccion_id', id).eq('employee_id', empId);
        if (error) { toast({ title: 'Error', description: 'No se pudo quitar', variant: 'destructive' }); return; }
        setAssigned(prev => prev.filter(e => e.id !== empId));
    };

    const filteredEmps = allEmployees.filter(e => !empSearch || e.nombre.toLowerCase().includes(empSearch.toLowerCase()));
    const statusCfg = form.status ? STATUS_CONFIG[form.status] : null;

    if (isLoading) return (
        <div className="min-h-screen p-8 bg-slate-50">
            <div className="max-w-4xl mx-auto animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-48" />
                <div className="h-64 bg-muted rounded" />
            </div>
        </div>
    );

    if (!deteccion) return null;

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground self-start -ml-2">
                        <ArrowLeft className="w-4 h-4 mr-1" />Volver
                    </Button>
                </div>
                <div className="flex items-center gap-3 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52] break-words">{deteccion.nombre}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-muted-foreground text-sm">Detección de Necesidad de Capacitación</p>
                            {statusCfg && (
                                <Badge className={statusCfg.bg}>{statusCfg.label}</Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section 1: Data */}
                <Card className="border-none shadow-lg mb-8">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold text-[#192b52]">Datos de la Detección</CardTitle>
                            <Button onClick={handleSave} disabled={isSaving} size="sm" className="bg-[#2166be] hover:bg-[#1a5299] text-white flex items-center gap-2">
                                <Save className="w-4 h-4" />{isSaving ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label htmlFor="dd-nombre">Nombre <span className="text-red-500">*</span></Label>
                                <Input id="dd-nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label htmlFor="dd-status">Status</Label>
                                <select id="dd-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="">Sin status</option>
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5"><Label htmlFor="dd-inst">Inst. Interno</Label><Input id="dd-inst" value={form.inst_interno} onChange={e => setForm(f => ({ ...f, inst_interno: e.target.value }))} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label htmlFor="dd-prov">Proveedor Sugerido</Label><Input id="dd-prov" value={form.proveedor_sugerido} onChange={e => setForm(f => ({ ...f, proveedor_sugerido: e.target.value }))} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label htmlFor="dd-costo">Costo</Label><Input id="dd-costo" type="number" min="0" step="any" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} placeholder="0.00" /></div>
                            <div className="space-y-1.5"><Label htmlFor="dd-dur">Duración (hrs)</Label><Input id="dd-dur" type="number" min="0" step="0.5" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} placeholder="0" /></div>
                            <div className="space-y-1.5"><Label htmlFor="dd-fprog">Fecha Programada</Label><Input id="dd-fprog" type="date" value={form.fecha_programada} onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))} /></div>
                            <div className="space-y-1.5"><Label htmlFor="dd-freal">Fecha Real</Label><Input id="dd-freal" type="date" value={form.fecha_real} onChange={e => setForm(f => ({ ...f, fecha_real: e.target.value }))} /></div>
                            <div className="sm:col-span-2 space-y-2">
                                <Label>Tipo de Capacitación</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {CHECKBOX_FIELDS.map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-[#2166be]" />
                                            <span className="text-sm">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label htmlFor="dd-com">Comentario</Label>
                                <textarea id="dd-com" value={form.comentario_dnc} onChange={e => setForm(f => ({ ...f, comentario_dnc: e.target.value }))} placeholder="Observaciones..." rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 2: Employees */}
                <Card className="border-none shadow-lg">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100">
                                    <Users className="w-4 h-4 text-green-600" />
                                </div>
                                <CardTitle className="text-lg font-semibold text-[#192b52]">Empleados asignados</CardTitle>
                                <Badge variant="secondary">{assigned.length}</Badge>
                            </div>
                            <Button size="sm" onClick={openAssign} className="bg-[#2166be] hover:bg-[#1a5299] text-white flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />Asignar empleado
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {assigned.length === 0 ? (
                            <div className="text-center py-10">
                                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                                <p className="text-muted-foreground text-sm">Sin empleados asignados</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            {['Nombre','Puesto','Departamento','Acción'].map(h => (
                                                <th key={h} className={`py-3 px-4 text-sm font-semibold text-[#192b52] ${h === 'Acción' ? 'text-right' : 'text-left'}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assigned.map((e, i) => (
                                            <tr key={e.id} className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                                                <td className="py-3 px-4 text-sm font-medium">{e.nombre}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{e.puesto}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{e.departamento || '—'}</td>
                                                <td className="py-3 px-4 text-right">
                                                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemove(e.id)}>
                                                        <Trash2 className="w-3.5 h-3.5 mr-1" />Quitar
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Assign modal */}
            <Dialog open={isAssignOpen} onOpenChange={v => { setIsAssignOpen(v); if (!v) { setSelected(new Set()); setEmpSearch(''); } }}>
                <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Asignar Empleados</DialogTitle>
                        <DialogDescription>Selecciona los empleados a asignar a esta detección</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto py-4 space-y-3">
                        <Input placeholder="Buscar por nombre..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                        <div className="space-y-1 max-h-72 overflow-y-auto">
                            {filteredEmps.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-6">{empSearch ? 'Sin resultados' : 'Todos los empleados ya están asignados'}</p>
                            ) : filteredEmps.map(e => (
                                <label key={e.id} className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer border transition-colors ${selected.has(e.id) ? 'border-[#2166be] bg-blue-50' : 'border-transparent hover:bg-muted/50'}`}>
                                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => {
                                        setSelected(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; });
                                    }} className="w-4 h-4 rounded border-gray-300 text-[#2166be]" />
                                    <div>
                                        <p className="text-sm font-medium">{e.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{e.puesto}{e.departamento ? ` · ${e.departamento}` : ''}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)} disabled={isAssigning}>Cancelar</Button>
                        <Button onClick={handleAssign} disabled={isAssigning || selected.size === 0} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
                            {isAssigning ? 'Asignando...' : `Asignar (${selected.size})`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

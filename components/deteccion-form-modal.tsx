"use client";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { COLORES_DETECCION } from '@/lib/detecciones-utils';

const CB = [
    { key: 'desarrollo_personal', label: 'Desarrollo Personal' },
    { key: 'habilidades_blandas', label: 'Habilidades Blandas' },
    { key: 'prevencion_riesgos', label: 'Prev. Riesgos' },
    { key: 'habilidades_tecnicas', label: 'Hab. Técnicas' },
] as const;

type EmpOption = {
    id: string;
    nombre: string;
    puesto: string;
    numero_empleado: string | null;
    departamento_id: string | null;
    departamento: string | null;
};

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSaved: () => void;
    plantId: string;
    yearId: string;
    editingId?: string | null;
    editingData?: any;
}

const EMPTY = {
    nombre: '', color: '#2166be', status: 'actualizacion',
    inst_interno: '', proveedor_sugerido: '', costo: '',
    fecha_programada: '', fecha_real: '', duration_hours: '',
    desarrollo_personal: false, habilidades_blandas: false,
    prevencion_riesgos: false, habilidades_tecnicas: false,
};

export function DeteccionFormModal({ open, onOpenChange, onSaved, plantId, yearId, editingId, editingData }: Props) {
    const { toast } = useToast();
    const [form, setForm] = useState({ ...EMPTY });
    const [allEmps, setAllEmps] = useState<EmpOption[]>([]);
    const [selEmps, setSelEmps] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [empSearch, setEmpSearch] = useState('');
    const [empsLoaded, setEmpsLoaded] = useState(false);

    // Load ALL plant employees once on first open
    useEffect(() => {
        if (!open || empsLoaded) return;
        loadAllEmps();
    }, [open]);

    // Pre-fill when editing
    useEffect(() => {
        if (!open) return;
        if (editingId && editingData) {
            const d = editingData;
            setForm({
                nombre: d.nombre || '', color: d.color || '#2166be', status: d.status || 'actualizacion',
                inst_interno: d.inst_interno || '', proveedor_sugerido: d.proveedor_sugerido || '',
                costo: d.costo != null ? String(d.costo) : '',
                fecha_programada: d.fecha_programada || '', fecha_real: d.fecha_real || '',
                duration_hours: d.duration_hours != null ? String(d.duration_hours) : '',
                desarrollo_personal: !!d.desarrollo_personal, habilidades_blandas: !!d.habilidades_blandas,
                prevencion_riesgos: !!d.prevencion_riesgos, habilidades_tecnicas: !!d.habilidades_tecnicas,
            });
            setSelEmps(new Set(d.emp_ids || []));
        } else {
            setForm({ ...EMPTY });
            setSelEmps(new Set());
        }
        setEmpSearch('');
    }, [open, editingId]);

    const loadAllEmps = async () => {
        const { data } = await supabase
            .from('employees')
            .select('id, nombre, puesto, numero_empleado, departamento_id, departamentos!departamento_id(nombre_completo)')
            .eq('plant_id', plantId)
            .order('nombre');
        const mapped: EmpOption[] = (data || []).map((e: any) => ({
            id: e.id,
            nombre: e.nombre,
            puesto: e.puesto,
            numero_empleado: e.numero_empleado ?? null,
            departamento_id: e.departamento_id,
            departamento: e.departamentos?.nombre_completo ?? null,
        }));
        setAllEmps(mapped);
        setEmpsLoaded(true);
    };

    const toggleEmp = (id: string) => {
        setSelEmps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nombre.trim()) {
            toast({ title: 'Error', description: 'Nombre requerido', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                nombre: form.nombre.trim(), color: form.color, status: form.status || null,
                plant_id: plantId, year_id: yearId,
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
            };

            let detId = editingId;
            if (editingId) {
                const { error } = await supabase.from('detecciones').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('detecciones').insert([payload]).select().single();
                if (error) throw error;
                detId = data.id;
            }

            // Sync employees
            await supabase.from('deteccion_empleados').delete().eq('deteccion_id', detId);
            const selectedEmpIds = Array.from(selEmps);
            if (selectedEmpIds.length > 0) {
                await supabase.from('deteccion_empleados').insert(
                    selectedEmpIds.map(eid => ({ deteccion_id: detId, employee_id: eid }))
                );
            }

            // Derive departments automatically from selected employees
            await supabase.from('deteccion_departamentos').delete().eq('deteccion_id', detId);
            const uniqueDeptIds = Array.from(new Set(
                allEmps
                    .filter(emp => selEmps.has(emp.id) && emp.departamento_id)
                    .map(emp => emp.departamento_id as string)
            ));
            if (uniqueDeptIds.length > 0) {
                await supabase.from('deteccion_departamentos').insert(
                    uniqueDeptIds.map(did => ({ deteccion_id: detId, departamento_id: did }))
                );
            }

            toast({ title: 'Éxito', description: editingId ? 'Detección actualizada' : 'Detección creada' });
            onSaved();
            onOpenChange(false);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Error al guardar', variant: 'destructive' });
        } finally { setIsSaving(false); }
    };

    const filteredEmps = allEmps.filter(e => {
        if (!empSearch) return true;
        const q = empSearch.toLowerCase();
        return (
            e.nombre.toLowerCase().includes(q) ||
            e.puesto?.toLowerCase().includes(q) ||
            e.departamento?.toLowerCase().includes(q) ||
            (e.numero_empleado != null && e.numero_empleado.toLowerCase().includes(q))
        );
    });

    const selectedCount = selEmps.size;

    return (
        <Dialog open={open} onOpenChange={v => {
            if (!v) { setForm({ ...EMPTY }); setSelEmps(new Set()); }
            onOpenChange(v);
        }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingId ? 'Editar Detección' : 'Nueva Detección'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave}>
                    <div className="space-y-5 py-4">
                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <Label>Nombre <span className="text-red-500">*</span></Label>
                            <Input value={form.nombre} onChange={e => f('nombre', e.target.value)} placeholder="Nombre de la detección" />
                        </div>

                        {/* Estado */}
                        <div className="space-y-1.5">
                            <Label>Estado</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {COLORES_DETECCION.map(c => {
                                    const active = form.color === c.hex;
                                    return (
                                        <button key={c.hex} type="button"
                                            onClick={() => { f('color', c.hex); f('status', c.status); }}
                                            className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${
                                                active ? 'border-gray-800 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-400'
                                            }`}>
                                            <div className="relative w-8 h-8">
                                                <span className="w-8 h-8 rounded-full block" style={{ background: c.hex }} />
                                                {active && (
                                                    <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">✓</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-center leading-tight text-muted-foreground">{c.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Empleados */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Empleados</Label>
                                {selectedCount > 0 && (
                                    <span className="text-xs text-[#2166be] font-medium">{selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>
                                )}
                            </div>
                            <Input
                                placeholder="Buscar por nombre, puesto, depto. o # empleado..."
                                value={empSearch}
                                onChange={e => setEmpSearch(e.target.value)}
                            />
                            <div className="border rounded-md p-2 max-h-52 overflow-y-auto space-y-0.5 bg-white">
                                {allEmps.length === 0 ? (
                                    <p className="text-xs text-muted-foreground p-2">Cargando empleados...</p>
                                ) : filteredEmps.length === 0 ? (
                                    <p className="text-xs text-muted-foreground p-2">Sin resultados</p>
                                ) : (
                                    filteredEmps.map(emp => (
                                        <label key={emp.id} className={`flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 text-sm transition-colors ${
                                            selEmps.has(emp.id) ? 'bg-blue-50 text-[#2166be]' : 'hover:bg-muted/50'
                                        }`}>
                                            <input type="checkbox" checked={selEmps.has(emp.id)} onChange={() => toggleEmp(emp.id)} className="w-4 h-4 rounded mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0">
                                                {emp.numero_empleado && (
                                                    <span className="text-[10px] font-mono text-muted-foreground mr-1.5">#{emp.numero_empleado}</span>
                                                )}
                                                <span className="font-medium">{emp.nombre}</span>
                                                <span className="text-muted-foreground ml-1">— {emp.puesto}</span>
                                                {emp.departamento && (
                                                    <span className="text-muted-foreground"> | {emp.departamento}</span>
                                                )}
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Campos DNC */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label>Inst. Interno</Label><Input value={form.inst_interno} onChange={e => f('inst_interno', e.target.value)} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label>Proveedor Sugerido</Label><Input value={form.proveedor_sugerido} onChange={e => f('proveedor_sugerido', e.target.value)} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label>Costo</Label><Input type="number" min="0" step="any" value={form.costo} onChange={e => f('costo', e.target.value)} placeholder="0.00" /></div>
                            <div className="space-y-1.5"><Label>Duración (hrs)</Label><Input type="number" min="0" step="0.5" value={form.duration_hours} onChange={e => f('duration_hours', e.target.value)} placeholder="0" /></div>
                            <div className="space-y-1.5"><Label>Fecha Programada</Label><Input type="date" value={form.fecha_programada} onChange={e => f('fecha_programada', e.target.value)} /></div>
                            <div className="space-y-1.5"><Label>Fecha Real</Label><Input type="date" value={form.fecha_real} onChange={e => f('fecha_real', e.target.value)} /></div>
                        </div>

                        {/* Tipo de Capacitación */}
                        <div className="space-y-2">
                            <Label>Tipo de Capacitación</Label>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                {CB.map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={form[key]} onChange={e => f(key, e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                                        <span className="text-sm">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                        <Button type="submit" disabled={isSaving} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

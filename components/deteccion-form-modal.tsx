"use client";
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

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
    area: string | null;
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
    nombre: '', color: '#ef4444', status: 'no_tomado',
    inst_interno: '', inst_externo: '', proveedor_sugerido: '', costo: '',
    fecha_programada: '', fecha_real: '', duration_hours: '',
    desarrollo_personal: false, habilidades_blandas: false,
    prevencion_riesgos: false, habilidades_tecnicas: false,
};

type Suggestion = { id: string; nombre: string; color: string };

export function DeteccionFormModal({ open, onOpenChange, onSaved, plantId, yearId, editingId, editingData }: Props) {
    const { toast } = useToast();
    const [form, setForm] = useState({ ...EMPTY });
    const [allEmps, setAllEmps] = useState<EmpOption[]>([]);
    const [selEmps, setSelEmps] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [empSearch, setEmpSearch] = useState('');
    const [empsLoaded, setEmpsLoaded] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isEditingExisting, setIsEditingExisting] = useState(false);
    const [suggestionEditId, setSuggestionEditId] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!open || empsLoaded) return;
        loadAllEmps();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setSuggestions([]);
        setShowSuggestions(false);
        setSuggestionEditId(null);
        setIsEditingExisting(false);
        if (editingId && editingData) {
            const d = editingData;
            setForm({
                nombre: d.nombre || '', color: d.color || '#2166be', status: d.status || 'actualizacion',
                inst_interno: d.inst_interno || '', inst_externo: d.inst_externo || '',
                proveedor_sugerido: d.proveedor_sugerido || '',
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
            .select('id, nombre, puesto, employee_number, area')
            .eq('plant_id', plantId)
            .order('nombre');
        const mapped: EmpOption[] = (data || []).map((e: any) => ({
            id: e.id,
            nombre: e.nombre,
            puesto: e.puesto,
            numero_empleado: e.employee_number ?? null,
            area: e.area ?? null,
        }));
        setAllEmps(mapped);
        setEmpsLoaded(true);
    };

    const toggleEmp = (id: string) => {
        setSelEmps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

    const searchSuggestions = async (term: string) => {
        const { data } = await supabase
            .from('detecciones')
            .select('id, nombre, color')
            .ilike('nombre', `%${term}%`)
            .eq('plant_id', plantId)
            .limit(5);
        if (data && data.length > 0) {
            setSuggestions(data as Suggestion[]);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleNombreChange = (val: string) => {
        f('nombre', val);
        if (editingId || isEditingExisting) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (val.trim().length >= 2) {
            debounceRef.current = setTimeout(() => searchSuggestions(val.trim()), 400);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = async (sug: Suggestion) => {
        setShowSuggestions(false);
        const { data } = await supabase.from('detecciones').select('*').eq('id', sug.id).maybeSingle();
        if (!data) return;
        setForm({
            nombre: data.nombre || '', color: data.color || '#2166be', status: data.status || 'actualizacion',
            inst_interno: data.inst_interno || '', inst_externo: data.inst_externo || '',
            proveedor_sugerido: data.proveedor_sugerido || '',
            costo: data.costo != null ? String(data.costo) : '',
            fecha_programada: data.fecha_programada || '', fecha_real: data.fecha_real || '',
            duration_hours: data.duration_hours != null ? String(data.duration_hours) : '',
            desarrollo_personal: !!data.desarrollo_personal, habilidades_blandas: !!data.habilidades_blandas,
            prevencion_riesgos: !!data.prevencion_riesgos, habilidades_tecnicas: !!data.habilidades_tecnicas,
        });
        const { data: empData } = await supabase
            .from('deteccion_empleados')
            .select('employee_id')
            .eq('deteccion_id', sug.id);
        setSelEmps(new Set((empData || []).map((r: any) => r.employee_id)));
        setSuggestionEditId(sug.id);
        setIsEditingExisting(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nombre.trim()) {
            toast({ title: 'Error', description: 'Nombre requerido', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        const activeEditingId = suggestionEditId || editingId;
        try {
            const payload = {
                nombre: form.nombre.trim(), color: form.color, status: form.status || null,
                plant_id: plantId, year_id: yearId,
                inst_interno: form.inst_interno.trim() || null,
                inst_externo: form.inst_externo.trim() || null,
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

            let detId = activeEditingId;
            if (activeEditingId) {
                const { error } = await supabase.from('detecciones').update(payload).eq('id', activeEditingId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('detecciones').insert([payload]).select().single();
                if (error) throw error;
                detId = data.id;
            }

            await supabase.from('deteccion_empleados').delete().eq('deteccion_id', detId);
            const selectedEmpIds = Array.from(selEmps);
            if (selectedEmpIds.length > 0) {
                await supabase.from('deteccion_empleados').insert(
                    selectedEmpIds.map(eid => ({ deteccion_id: detId, employee_id: eid }))
                );
            }

            toast({ title: 'Éxito', description: activeEditingId ? 'Detección actualizada' : 'Detección creada' });
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
            e.area?.toLowerCase().includes(q) ||
            (e.numero_empleado != null && e.numero_empleado.toLowerCase().includes(q))
        );
    });

    const selectedCount = selEmps.size;

    return (
        <Dialog open={open} onOpenChange={v => {
            if (!v) { setForm({ ...EMPTY }); setSelEmps(new Set()); }
            onOpenChange(v);
        }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{(editingId || isEditingExisting) ? 'Editar Detección' : 'Nueva Detección'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave}>
                    <div className="space-y-5 py-4">
                        {isEditingExisting && (
                            <div className="flex items-center justify-between gap-2 bg-yellow-50 border border-yellow-300 rounded-md px-3 py-2 text-sm text-yellow-800">
                                <span className="font-medium truncate">Editando detección existente: {form.nombre}</span>
                                <button
                                    type="button"
                                    onClick={() => { setSuggestionEditId(null); setIsEditingExisting(false); }}
                                    className="flex-shrink-0 text-yellow-700 hover:text-yellow-900 font-semibold"
                                >
                                    ✕ Crear nueva en su lugar
                                </button>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label>Nombre <span className="text-red-500">*</span></Label>
                            <div
                                className="relative"
                                onBlur={() => { blurRef.current = setTimeout(() => setShowSuggestions(false), 150); }}
                                onFocus={() => { if (blurRef.current) clearTimeout(blurRef.current); }}
                            >
                                <Input
                                    value={form.nombre}
                                    onChange={e => handleNombreChange(e.target.value)}
                                    placeholder="Nombre de la detección"
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                                        {suggestions.map(sug => (
                                            <button
                                                key={sug.id}
                                                type="button"
                                                onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(sug); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 text-left transition-colors border-b last:border-0"
                                            >
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sug.color || '#2166be' }} />
                                                <span className="flex-1 font-medium text-[#192b52] truncate">{sug.nombre}</span>
                                                <span className="text-xs text-muted-foreground flex-shrink-0">Detección existente — click para editar</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Empleados</Label>
                                {selectedCount > 0 && (
                                    <span className="text-xs text-[#2166be] font-medium">{selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>
                                )}
                            </div>
                            <Input
                                placeholder="Buscar por nombre, puesto, área o # empleado..."
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
                                        <label key={emp.id} className={`flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 text-sm transition-colors ${selEmps.has(emp.id) ? 'bg-blue-50 text-[#2166be]' : 'hover:bg-muted/50'
                                            }`}>
                                            <input type="checkbox" checked={selEmps.has(emp.id)} onChange={() => toggleEmp(emp.id)} className="w-4 h-4 rounded mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0">
                                                {emp.numero_empleado && (
                                                    <span className="text-[10px] font-mono text-muted-foreground mr-1.5">#{emp.numero_empleado}</span>
                                                )}
                                                <span className="font-medium">{emp.nombre}</span>
                                                <span className="text-muted-foreground ml-1">— {emp.puesto}</span>
                                                {emp.area && (
                                                    <span className="text-muted-foreground"> | {emp.area}</span>
                                                )}
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label>Inst. Interno</Label><Input value={form.inst_interno} onChange={e => f('inst_interno', e.target.value)} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label>Inst. Externo</Label><Input value={form.inst_externo} onChange={e => f('inst_externo', e.target.value)} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label>Proveedor Sugerido</Label><Input value={form.proveedor_sugerido} onChange={e => f('proveedor_sugerido', e.target.value)} placeholder="—" /></div>
                            <div className="space-y-1.5"><Label>Costo</Label><Input type="number" min="0" step="any" value={form.costo} onChange={e => f('costo', e.target.value)} placeholder="0.00" /></div>
                            <div className="space-y-1.5"><Label>Duración (hrs)</Label><Input type="number" min="0" step="0.5" value={form.duration_hours} onChange={e => f('duration_hours', e.target.value)} placeholder="0" /></div>
                            <div className="space-y-1.5"><Label>Fecha Programada</Label><Input type="date" value={form.fecha_programada} onChange={e => f('fecha_programada', e.target.value)} /></div>
                            <div className="space-y-1.5"><Label>Fecha Real</Label><Input type="date" value={form.fecha_real} onChange={e => f('fecha_real', e.target.value)} /></div>
                        </div>

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

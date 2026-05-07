"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

export type DeteccionStatus = 'tomado' | 'no_tomado' | 'reprogramado' | 'actualizacion' | null;

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    tomado: { label: 'Tomado', color: '#22c55e', bg: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    no_tomado: { label: 'No tomado', color: '#ef4444', bg: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
    reprogramado: { label: 'Reprogramado', color: '#FFB433', bg: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
    actualizacion: { label: 'Actualización', color: '#3b82f6', bg: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
};

type DeteccionRow = {
    id: string; nombre: string; status: DeteccionStatus;
    fecha_programada: string | null; fecha_real: string | null; employee_count: number;
};

export function fmtDate(v: string | null | undefined) {
    if (!v) return '—';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
}

export function StatusCombo({ id, value, onChange }: { id: string; value: DeteccionStatus; onChange: (v: DeteccionStatus) => void }) {
    const cfg = value ? STATUS_CONFIG[value] : null;
    return (
        <div className="relative inline-flex items-center gap-1.5">
            {cfg && <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
            <select
                value={value ?? ''}
                onChange={e => onChange((e.target.value || null) as DeteccionStatus)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2166be] pr-6"
                style={{ color: cfg?.color ?? '#6b7280' }}
            >
                <option value="">Sin status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k} style={{ color: v.color }}>{v.label}</option>
                ))}
            </select>
        </div>
    );
}

const CHECKBOX_FIELDS = [
    { key: 'desarrollo_personal' as const, label: 'Desarrollo Personal y Académico' },
    { key: 'habilidades_blandas' as const, label: 'Habilidades Blandas' },
    { key: 'prevencion_riesgos' as const, label: 'Prevención de Riesgos y Accidentes' },
    { key: 'habilidades_tecnicas' as const, label: 'Habilidades Técnicas' },
];

const EMPTY_FORM = {
    nombre: '', inst_interno: '', proveedor_sugerido: '', costo: '',
    fecha_programada: '', fecha_real: '', duration_hours: '',
    desarrollo_personal: false, habilidades_blandas: false,
    prevencion_riesgos: false, habilidades_tecnicas: false,
    comentario_dnc: '', status: '',
};

export default function DeteccionesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [rows, setRows] = useState<DeteccionRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [isSaving, setIsSaving] = useState(false);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('detecciones').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            const { data: counts } = await supabase.from('deteccion_empleados').select('deteccion_id');
            const cmap: Record<string, number> = {};
            (counts || []).forEach((r: any) => { cmap[r.deteccion_id] = (cmap[r.deteccion_id] || 0) + 1; });
            setRows((data || []).map((d: any) => ({ id: d.id, nombre: d.nombre, status: d.status, fecha_programada: d.fecha_programada, fecha_real: d.fecha_real, employee_count: cmap[d.id] || 0 })));
        } catch { toast({ title: 'Error', description: 'No se pudieron cargar las detecciones', variant: 'destructive' }); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleStatusChange = async (id: string, v: DeteccionStatus) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, status: v } : r));
        const { error } = await supabase.from('detecciones').update({ status: v }).eq('id', id);
        if (error) { toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' }); fetchAll(); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nombre.trim()) { toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' }); return; }
        setIsSaving(true);
        try {
            const { error } = await supabase.from('detecciones').insert([{
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
            }]);
            if (error) throw error;
            setForm({ ...EMPTY_FORM }); setIsCreateOpen(false); fetchAll();
            toast({ title: 'Éxito', description: 'Detección creada' });
        } catch (err: any) { toast({ title: 'Error', description: err.message || 'Error al crear', variant: 'destructive' }); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                                <ClipboardCheck className="w-5 h-5 text-[#2166be]" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">Detecciones</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${v.dot}`} />{v.label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-[#2166be] hover:bg-[#1a5299] text-white flex items-center gap-2 flex-shrink-0">
                        <Plus className="w-4 h-4" />Nueva detección
                    </Button>
                </div>

                <Card className="border-none shadow-lg">
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <div className="animate-pulse space-y-3 py-4">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-16">
                                <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                <p className="text-muted-foreground text-sm">No hay detecciones registradas</p>
                                <Button onClick={() => setIsCreateOpen(true)} className="mt-4 bg-[#2166be] hover:bg-[#1a5299] text-white"><Plus className="w-4 h-4 mr-1" />Nueva</Button>
                            </div>
                        ) : (
                            <>
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                {['Nombre', 'Status', 'Fecha Programada', 'Fecha Real', 'Empleados', 'Acciones'].map(h => (
                                                    <th key={h} className={`py-3 px-4 text-sm font-semibold text-[#192b52] ${h === 'Empleados' ? 'text-center' : h === 'Acciones' ? 'text-right' : 'text-left'}`}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((d, i) => (
                                                <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                                                    <td className="py-3 px-4 text-sm font-medium max-w-[260px]"><span className="block truncate">{d.nombre}</span></td>
                                                    <td className="py-2 px-4"><StatusCombo id={d.id} value={d.status} onChange={v => handleStatusChange(d.id, v)} /></td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">{fmtDate(d.fecha_programada)}</td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">{fmtDate(d.fecha_real)}</td>
                                                    <td className="py-3 px-4 text-center"><Badge variant="secondary">{d.employee_count}</Badge></td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button size="sm" variant="outline" className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white" onClick={() => router.push(`/detecciones/${d.id}`)}>
                                                            <Eye className="w-3.5 h-3.5 mr-1.5" />Ver
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden space-y-3">
                                    {rows.map(d => (
                                        <div key={d.id} className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-medium text-sm break-words flex-1">{d.nombre}</p>
                                                <Button size="sm" variant="outline" className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white flex-shrink-0" onClick={() => router.push(`/detecciones/${d.id}`)}>Ver</Button>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                <StatusCombo id={d.id} value={d.status} onChange={v => handleStatusChange(d.id, v)} />
                                                <span>F. Prog: {fmtDate(d.fecha_programada)}</span>
                                                <Badge variant="secondary">{d.employee_count} emp.</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create modal */}
            <Dialog open={isCreateOpen} onOpenChange={v => { if (!v) setForm({ ...EMPTY_FORM }); setIsCreateOpen(v); }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nueva Detección</DialogTitle>
                        <DialogDescription>Registra una nueva detección de necesidad de capacitación</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="det-nombre">Nombre <span className="text-red-500">*</span></Label>
                                <Input id="det-nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre de la detección" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="det-status">Status</Label>
                                <select id="det-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="">Sin status</option>
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><Label htmlFor="det-inst">Inst. Interno</Label><Input id="det-inst" value={form.inst_interno} onChange={e => setForm(f => ({ ...f, inst_interno: e.target.value }))} placeholder="—" /></div>
                                <div className="space-y-1.5"><Label htmlFor="det-prov">Proveedor Sugerido</Label><Input id="det-prov" value={form.proveedor_sugerido} onChange={e => setForm(f => ({ ...f, proveedor_sugerido: e.target.value }))} placeholder="—" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><Label htmlFor="det-costo">Costo</Label><Input id="det-costo" type="number" min="0" step="any" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} placeholder="0.00" /></div>
                                <div className="space-y-1.5"><Label htmlFor="det-dur">Duración (hrs)</Label><Input id="det-dur" type="number" min="0" step="0.5" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} placeholder="0" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><Label htmlFor="det-fprog">Fecha Programada</Label><Input id="det-fprog" type="date" value={form.fecha_programada} onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))} /></div>
                                <div className="space-y-1.5"><Label htmlFor="det-freal">Fecha Real</Label><Input id="det-freal" type="date" value={form.fecha_real} onChange={e => setForm(f => ({ ...f, fecha_real: e.target.value }))} /></div>
                            </div>
                            <div className="space-y-2">
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
                            <div className="space-y-1.5">
                                <Label htmlFor="det-com">Comentario</Label>
                                <textarea id="det-com" value={form.comentario_dnc} onChange={e => setForm(f => ({ ...f, comentario_dnc: e.target.value }))} placeholder="Observaciones..." rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setForm({ ...EMPTY_FORM }); setIsCreateOpen(false); }} disabled={isSaving}>Cancelar</Button>
                            <Button type="submit" disabled={isSaving} className="bg-[#2166be] hover:bg-[#1a5299] text-white">{isSaving ? 'Guardando...' : 'Guardar'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

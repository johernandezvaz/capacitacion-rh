"use client";
import { useState, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

type TabForm = {
    id: string;
    nombre: string;
    inst_interno: boolean;
    inst_externo: boolean;
    proveedor_sugerido: string;
    costo: string;
    fecha_programada: string;
    fecha_real: string;
    duration_hours: string;
    desarrollo_personal: boolean;
    habilidades_blandas: boolean;
    prevencion_riesgos: boolean;
    habilidades_tecnicas: boolean;
    selEmps: Set<string>;
    empSearch: string;
    showSuggestions: boolean;
    suggestions: Suggestion[];
    isEditingExisting: boolean;
    suggestionEditId: string | null;
    linkedCourseId: string | null;
    courseSearch: string;
    selectedCourseName: string;
    courseSuggestions: CourseOption[];
    showCourseSuggestions: boolean;
};

type Suggestion = { id: string; nombre: string; color: string };
type CourseOption = { id: string; name: string; year: number | null };

function newEmptyTab(n: number): TabForm {
    return {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }),
        nombre: '',
        inst_interno: false,
        inst_externo: false,
        proveedor_sugerido: '',
        costo: '',
        fecha_programada: '',
        fecha_real: '',
        duration_hours: '',
        desarrollo_personal: false,
        habilidades_blandas: false,
        prevencion_riesgos: false,
        habilidades_tecnicas: false,
        selEmps: new Set(),
        empSearch: '',
        showSuggestions: false,
        suggestions: [],
        isEditingExisting: false,
        suggestionEditId: null,
        linkedCourseId: null,
        courseSearch: '',
        selectedCourseName: '',
        courseSuggestions: [],
        showCourseSuggestions: false,
    };
}

function calcColor(fecha_real: string): string {
    const today = new Date().toISOString().split('T')[0];
    return fecha_real && fecha_real <= today ? '#22c55e' : '#ef4444';
}

export function DeteccionFormModal({ open, onOpenChange, onSaved, plantId, yearId, editingId, editingData }: Props) {
    const { toast } = useToast();
    const [tabs, setTabs] = useState<TabForm[]>([newEmptyTab(1)]);
    const [activeTabId, setActiveTabId] = useState('');
    const [allEmps, setAllEmps] = useState<EmpOption[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [empsLoaded, setEmpsLoaded] = useState(false);
    const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const courseDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const blurRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const courseBlurRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const isEditMode = !!(editingId);

    useEffect(() => {
        if (!open || empsLoaded) return;
        loadAllEmps();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (editingId && editingData) {
            const d = editingData;
            const tab: TabForm = {
                ...newEmptyTab(1),
                nombre: d.nombre || '',
                inst_interno: !!d.inst_interno,
                inst_externo: !!d.inst_externo,
                proveedor_sugerido: d.proveedor_sugerido || '',
                costo: d.costo != null ? String(d.costo) : '',
                fecha_programada: d.fecha_programada || '',
                fecha_real: d.fecha_real || '',
                duration_hours: d.duration_hours != null ? String(d.duration_hours) : '',
                desarrollo_personal: !!d.desarrollo_personal,
                habilidades_blandas: !!d.habilidades_blandas,
                prevencion_riesgos: !!d.prevencion_riesgos,
                habilidades_tecnicas: !!d.habilidades_tecnicas,
                selEmps: new Set(d.emp_ids || []),
                linkedCourseId: d.course_id ?? null,
                selectedCourseName: d.course_name ?? '',
                courseSearch: d.course_name ?? '',
            };
            setTabs([tab]);
            setActiveTabId(tab.id);
        } else {
            const t = newEmptyTab(1);
            setTabs([t]);
            setActiveTabId(t.id);
        }
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

    const updateTab = (tabId: string, patch: Partial<TabForm>) => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...patch } : t));
    };

    const addTab = () => {
        const t = newEmptyTab(tabs.length + 1);
        setTabs(prev => [...prev, t]);
        setActiveTabId(t.id);
    };

    const removeTab = (tabId: string) => {
        if (tabs.length <= 1) return;
        const idx = tabs.findIndex(t => t.id === tabId);
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        if (activeTabId === tabId) {
            setActiveTabId(newTabs[Math.max(0, idx - 1)].id);
        }
    };

    const searchSuggestions = async (tabId: string, term: string) => {
        const { data } = await supabase
            .from('detecciones')
            .select('id, nombre, color')
            .ilike('nombre', `%${term}%`)
            .eq('plant_id', plantId)
            .limit(5);
        if (data && data.length > 0) {
            updateTab(tabId, { suggestions: data as Suggestion[], showSuggestions: true });
        } else {
            updateTab(tabId, { suggestions: [], showSuggestions: false });
        }
    };

    const searchCourses = async (tabId: string, term: string) => {
        const { data } = await supabase
            .from('courses')
            .select('id, name, year_id, training_years!year_id(year)')
            .eq('plant_id', plantId)
            .ilike('name', `%${term}%`)
            .limit(8);
        const opts: CourseOption[] = (data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            year: c.training_years?.year ?? null,
        }));
        updateTab(tabId, { courseSuggestions: opts, showCourseSuggestions: opts.length > 0 });
    };

    const handleNombreChange = (tabId: string, val: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;
        updateTab(tabId, { nombre: val });
        if (editingId || tab.isEditingExisting) return;
        if (debounceRef.current[tabId]) clearTimeout(debounceRef.current[tabId]);
        if (val.trim().length >= 2) {
            debounceRef.current[tabId] = setTimeout(() => searchSuggestions(tabId, val.trim()), 400);
        } else {
            updateTab(tabId, { suggestions: [], showSuggestions: false });
        }
    };

    const handleSelectSuggestion = async (tabId: string, sug: Suggestion) => {
        updateTab(tabId, { showSuggestions: false });
        const { data } = await supabase.from('detecciones').select('*').eq('id', sug.id).maybeSingle();
        if (!data) return;
        const { data: empData } = await supabase
            .from('deteccion_empleados')
            .select('employee_id')
            .eq('deteccion_id', sug.id);
        updateTab(tabId, {
            nombre: data.nombre || '',
            inst_interno: !!data.inst_interno,
            inst_externo: !!data.inst_externo,
            proveedor_sugerido: data.proveedor_sugerido || '',
            costo: data.costo != null ? String(data.costo) : '',
            fecha_programada: data.fecha_programada || '',
            fecha_real: data.fecha_real || '',
            duration_hours: data.duration_hours != null ? String(data.duration_hours) : '',
            desarrollo_personal: !!data.desarrollo_personal,
            habilidades_blandas: !!data.habilidades_blandas,
            prevencion_riesgos: !!data.prevencion_riesgos,
            habilidades_tecnicas: !!data.habilidades_tecnicas,
            selEmps: new Set((empData || []).map((r: any) => r.employee_id)),
            suggestionEditId: sug.id,
            isEditingExisting: true,
        });
    };

    const handleSelectCourse = (tabId: string, opt: CourseOption) => {
        updateTab(tabId, {
            linkedCourseId: opt.id,
            selectedCourseName: opt.name,
            courseSearch: opt.year ? `${opt.name} (${opt.year})` : opt.name,
            courseSuggestions: [],
            showCourseSuggestions: false,
        });
    };

    const clearCourse = (tabId: string) => {
        updateTab(tabId, {
            linkedCourseId: null,
            selectedCourseName: '',
            courseSearch: '',
            courseSuggestions: [],
            showCourseSuggestions: false,
        });
    };

    const handleCourseSearchChange = (tabId: string, val: string) => {
        updateTab(tabId, { courseSearch: val });
        if (!val.trim()) { clearCourse(tabId); return; }
        if (courseDebounceRef.current[tabId]) clearTimeout(courseDebounceRef.current[tabId]);
        courseDebounceRef.current[tabId] = setTimeout(() => searchCourses(tabId, val.trim()), 350);
    };

    const toggleEmp = (tabId: string, empId: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;
        const n = new Set(tab.selEmps);
        n.has(empId) ? n.delete(empId) : n.add(empId);
        updateTab(tabId, { selEmps: n });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);

        let saved = 0;
        const errors: string[] = [];

        for (const tab of tabs) {
            if (!tab.nombre.trim()) {
                errors.push(`Pestaña "${tab.nombre || 'sin nombre'}": nombre requerido`);
                continue;
            }
            try {
                const color = calcColor(tab.fecha_real);
                const payload = {
                    nombre: tab.nombre.trim(),
                    color,
                    status: null as string | null,
                    plant_id: plantId,
                    year_id: yearId,
                    inst_interno: tab.inst_interno,
                    inst_externo: tab.inst_externo,
                    proveedor_sugerido: tab.proveedor_sugerido.trim() || null,
                    costo: tab.costo ? parseFloat(tab.costo) : null,
                    fecha_programada: tab.fecha_programada || null,
                    fecha_real: tab.fecha_real || null,
                    duration_hours: tab.duration_hours ? parseFloat(tab.duration_hours) : null,
                    desarrollo_personal: tab.desarrollo_personal,
                    habilidades_blandas: tab.habilidades_blandas,
                    prevencion_riesgos: tab.prevencion_riesgos,
                    habilidades_tecnicas: tab.habilidades_tecnicas,
                };

                const activeEditingId = tab.suggestionEditId || editingId;
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
                const selectedEmpIds = Array.from(tab.selEmps);
                if (selectedEmpIds.length > 0) {
                    await supabase.from('deteccion_empleados').insert(
                        selectedEmpIds.map(eid => ({ deteccion_id: detId, employee_id: eid }))
                    );
                }

                if (tab.linkedCourseId && detId) {
                    await supabase.from('courses').update({
                        deteccion_id: detId,
                        inst_interno: tab.inst_interno,
                        inst_externo: tab.inst_externo,
                        proveedor_sugerido: tab.proveedor_sugerido.trim() || null,
                        costo: tab.costo ? parseFloat(tab.costo) : null,
                        desarrollo_personal: tab.desarrollo_personal,
                        habilidades_blandas: tab.habilidades_blandas,
                        prevencion_riesgos: tab.prevencion_riesgos,
                        habilidades_tecnicas: tab.habilidades_tecnicas,
                        fecha_programada: tab.fecha_programada || null,
                        fecha_real: tab.fecha_real || null,
                        duration_hours: tab.duration_hours ? parseFloat(tab.duration_hours) : null,
                    }).eq('id', tab.linkedCourseId);
                }

                saved++;
            } catch (err: any) {
                errors.push(`"${tab.nombre}": ${err.message || 'Error al guardar'}`);
            }
        }

        setIsSaving(false);

        if (errors.length > 0) {
            toast({
                title: `${saved} guardada(s), ${errors.length} con error`,
                description: errors.join(' | '),
                variant: 'destructive',
            });
        } else {
            toast({ title: 'Éxito', description: `${saved} detección${saved !== 1 ? 'es' : ''} guardada${saved !== 1 ? 's' : ''}` });
        }

        if (saved > 0) {
            onSaved();
            onOpenChange(false);
        }
    };

    const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

    const filteredEmps = allEmps.filter(e => {
        if (!activeTab?.empSearch) return true;
        const q = activeTab.empSearch.toLowerCase();
        return (
            e.nombre.toLowerCase().includes(q) ||
            e.puesto?.toLowerCase().includes(q) ||
            e.area?.toLowerCase().includes(q) ||
            (e.numero_empleado != null && e.numero_empleado.toLowerCase().includes(q))
        );
    });

    return (
        <Dialog open={open} onOpenChange={v => {
            if (!v) {
                const t = newEmptyTab(1);
                setTabs([t]);
                setActiveTabId(t.id);
            }
            onOpenChange(v);
        }}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Editar Detección' : 'Nueva Detección'}</DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-1 border-b pb-0 -mb-px overflow-x-auto">
                    {tabs.map((tab, idx) => (
                        <div
                            key={tab.id}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer border-b-2 whitespace-nowrap flex-shrink-0 transition-colors ${tab.id === activeTabId
                                ? 'border-[#2166be] text-[#2166be] font-semibold bg-blue-50/60'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                }`}
                            onClick={() => setActiveTabId(tab.id)}
                        >
                            <span className="max-w-[140px] truncate">
                                {tab.nombre.trim() || `Nueva detección ${idx + 1}`}
                            </span>
                            {!isEditMode && tabs.length > 1 && (
                                <button
                                    type="button"
                                    className="ml-1 rounded-full hover:bg-red-100 hover:text-red-500 p-0.5 transition-colors"
                                    onClick={e => { e.stopPropagation(); removeTab(tab.id); }}
                                    title="Eliminar pestaña"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    {!isEditMode && (
                        <button
                            type="button"
                            onClick={addTab}
                            className="flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-[#2166be] hover:bg-blue-50/60 rounded transition-colors flex-shrink-0"
                            title="Agregar detección"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {activeTab && (
                    <form onSubmit={handleSave}>
                        <div className="space-y-5 py-4">
                            {activeTab.isEditingExisting && (
                                <div className="flex items-center justify-between gap-2 bg-yellow-50 border border-yellow-300 rounded-md px-3 py-2 text-sm text-yellow-800">
                                    <span className="font-medium truncate">Editando detección existente: {activeTab.nombre}</span>
                                    <button
                                        type="button"
                                        onClick={() => updateTab(activeTab.id, { suggestionEditId: null, isEditingExisting: false })}
                                        className="flex-shrink-0 text-yellow-700 hover:text-yellow-900 font-semibold"
                                    >
                                        ✕ Crear nueva en su lugar
                                    </button>
                                </div>
                            )}

                            {editingId && editingData?.course_id && (
                                <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                                    <span className="text-base">📘</span>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-xs text-green-700">Curso vinculado</span>
                                        <span className="font-medium">{editingData.course_name}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label>Nombre <span className="text-red-500">*</span></Label>
                                <div
                                    className="relative"
                                    onBlur={() => { blurRef.current[activeTab.id] = setTimeout(() => updateTab(activeTab.id, { showSuggestions: false }), 150); }}
                                    onFocus={() => { if (blurRef.current[activeTab.id]) clearTimeout(blurRef.current[activeTab.id]); }}
                                >
                                    <Input
                                        value={activeTab.nombre}
                                        onChange={e => handleNombreChange(activeTab.id, e.target.value)}
                                        placeholder="Nombre de la detección"
                                    />
                                    {activeTab.showSuggestions && activeTab.suggestions.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                                            {activeTab.suggestions.map(sug => (
                                                <button
                                                    key={sug.id}
                                                    type="button"
                                                    onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(activeTab.id, sug); }}
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
                                <Label>Vincular a curso existente <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                                <div
                                    className="relative"
                                    onBlur={() => { courseBlurRef.current[activeTab.id] = setTimeout(() => updateTab(activeTab.id, { showCourseSuggestions: false }), 150); }}
                                    onFocus={() => { if (courseBlurRef.current[activeTab.id]) clearTimeout(courseBlurRef.current[activeTab.id]); }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                            <Input
                                                value={!!(editingId && editingData?.course_id) ? (editingData.course_name ?? '') : activeTab.courseSearch}
                                                onChange={e => handleCourseSearchChange(activeTab.id, e.target.value)}
                                                placeholder="Buscar curso por nombre..."
                                                className="pl-8"
                                                disabled={!!(editingId && editingData?.course_id)}
                                            />
                                        </div>
                                        {activeTab.linkedCourseId && !(editingId && editingData?.course_id) && (
                                            <button type="button" onClick={() => clearCourse(activeTab.id)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Limpiar">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {activeTab.showCourseSuggestions && activeTab.courseSuggestions.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                                            {activeTab.courseSuggestions.map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onMouseDown={e => { e.preventDefault(); handleSelectCourse(activeTab.id, opt); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left transition-colors border-b last:border-0"
                                                >
                                                    <span className="flex-1 font-medium text-[#192b52] truncate">{opt.name}</span>
                                                    {opt.year && <span className="text-xs text-muted-foreground flex-shrink-0">{opt.year}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {activeTab.linkedCourseId && (
                                    <p className="text-xs text-[#22c55e] font-medium flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" />
                                        Curso vinculado: {activeTab.selectedCourseName}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label>Empleados</Label>
                                    {activeTab.selEmps.size > 0 && (
                                        <span className="text-xs text-[#2166be] font-medium">{activeTab.selEmps.size} seleccionado{activeTab.selEmps.size > 1 ? 's' : ''}</span>
                                    )}
                                </div>
                                <Input
                                    placeholder="Buscar por nombre, puesto, área o # empleado..."
                                    value={activeTab.empSearch}
                                    onChange={e => updateTab(activeTab.id, { empSearch: e.target.value })}
                                />
                                <div className="border rounded-md p-2 max-h-52 overflow-y-auto space-y-0.5 bg-white">
                                    {allEmps.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-2">Cargando empleados...</p>
                                    ) : filteredEmps.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-2">Sin resultados</p>
                                    ) : (
                                        filteredEmps.map(emp => (
                                            <label key={emp.id} className={`flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 text-sm transition-colors ${activeTab.selEmps.has(emp.id) ? 'bg-blue-50 text-[#2166be]' : 'hover:bg-muted/50'}`}>
                                                <input type="checkbox" checked={activeTab.selEmps.has(emp.id)} onChange={() => toggleEmp(activeTab.id, emp.id)} className="w-4 h-4 rounded mt-0.5 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    {emp.numero_empleado && (
                                                        <span className="text-[10px] font-mono text-muted-foreground mr-1.5">#{emp.numero_empleado}</span>
                                                    )}
                                                    <span className="font-medium">{emp.nombre}</span>
                                                    <span className="text-muted-foreground ml-1">— {emp.puesto}</span>
                                                    {emp.area && <span className="text-muted-foreground"> | {emp.area}</span>}
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 py-1">
                                    <Checkbox
                                        id={`inst_interno_${activeTab.id}`}
                                        checked={activeTab.inst_interno}
                                        onCheckedChange={v => updateTab(activeTab.id, { inst_interno: !!v })}
                                    />
                                    <Label htmlFor={`inst_interno_${activeTab.id}`} className="cursor-pointer">Inst. Interno</Label>
                                </div>
                                <div className="flex items-center gap-2 py-1">
                                    <Checkbox
                                        id={`inst_externo_${activeTab.id}`}
                                        checked={activeTab.inst_externo}
                                        onCheckedChange={v => updateTab(activeTab.id, { inst_externo: !!v })}
                                    />
                                    <Label htmlFor={`inst_externo_${activeTab.id}`} className="cursor-pointer">Inst. Externo</Label>
                                </div>

                                <div className="space-y-1.5"><Label>Proveedor Sugerido</Label><Input value={activeTab.proveedor_sugerido} onChange={e => updateTab(activeTab.id, { proveedor_sugerido: e.target.value })} placeholder="—" /></div>
                                <div className="space-y-1.5"><Label>Costo</Label><Input type="number" min="0" step="any" value={activeTab.costo} onChange={e => updateTab(activeTab.id, { costo: e.target.value })} placeholder="0.00" /></div>
                                <div className="space-y-1.5"><Label>Duración (hrs)</Label><Input type="number" min="0" step="0.5" value={activeTab.duration_hours} onChange={e => updateTab(activeTab.id, { duration_hours: e.target.value })} placeholder="0" /></div>
                                <div className="space-y-1.5"><Label>Fecha Programada</Label><Input type="date" value={activeTab.fecha_programada} onChange={e => updateTab(activeTab.id, { fecha_programada: e.target.value })} /></div>
                                <div className="space-y-1.5"><Label>Fecha Real</Label><Input type="date" value={activeTab.fecha_real} onChange={e => updateTab(activeTab.id, { fecha_real: e.target.value })} /></div>
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Capacitación</Label>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    {CB.map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={activeTab[key]} onChange={e => updateTab(activeTab.id, { [key]: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
                                            <span className="text-sm">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                            <Button type="submit" disabled={isSaving} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
                                {isSaving ? 'Guardando...' : isEditMode ? 'Guardar' : `Guardar ${tabs.length > 1 ? `(${tabs.length})` : ''}`}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

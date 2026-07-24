"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, FileDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { OjtEmployeeSelect } from '@/components/ojt-employee-select';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  supabase, Employee, OjtEntry, OjtSectionWithEntries,
} from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { generateOjtInstancePdf } from '@/lib/ojt-pdf';
import type { PdfSectionGroup, PdfInstanceRow } from '@/lib/ojt-pdf';

const PILOTO_OPTIONS = [
  { code: 'P01', label: 'P01 — Define and Deploy the strategy' },
  { code: 'P02', label: 'P02 — Manage the safety and environment' },
  { code: 'C02', label: 'C02 — Fulfill Market Expectation' },
  { code: 'C03', label: 'C03 — Manage the development of product and process' },
  { code: 'C04', label: 'C04 — Manufacture ship, invoice and be paid in mass production' },
  { code: 'S01', label: 'S01 — Manage the suppliers for product and services' },
  { code: 'S05', label: 'S05 — Perform Physical test and Metrological Measurements' },
  { code: 'S06', label: 'S06 — Manage Information Technology' },
  { code: 'S09', label: "S09 — Provide the means and infrastructure and ensure it's reliability" },
  { code: 'S10', label: 'S10 — Recruit, involve, Motivate and manage the human ressources and their health' },
];

const ENTRY_COLS: Array<{ key: keyof OjtEntry; label: string; type: string; minW: string }> = [
  { key: 'conocimiento_requerido', label: 'Conocimiento Requerido', type: 'text', minW: '160px' },
  { key: 'habilidades', label: 'Habilidades', type: 'text', minW: '140px' },
  { key: 'fuentes_informacion', label: 'Fuentes de Información', type: 'text', minW: '160px' },
  { key: 'procedimientos_internos', label: 'Procedimientos Internos', type: 'text', minW: '170px' },
  { key: 'metodo_entrenamiento', label: 'Método de Entrenamiento', type: 'text', minW: '170px' },
  { key: 'duracion', label: 'Duración', type: 'text', minW: '100px' },
  { key: 'puesto_responsable', label: 'Puesto Responsable', type: 'text', minW: '160px' },
];

interface OjtFormProps { recordId: string | null; plantId: string; }

export function OjtForm({ recordId, plantId }: OjtFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!recordId);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(recordId);

  const [titulo, setTitulo] = useState('');
  const [puesto, setPuesto] = useState('');
  const [periodo, setPeriodo] = useState('');

  const [esPiloto, setEsPiloto] = useState(false);
  const [pilotoCodigo, setPilotoCodigo] = useState('');
  const [esBrigada, setEsBrigada] = useState(false);
  const [sections, setSections] = useState<OjtSectionWithEntries[]>([]);

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, nombre, puesto, employee_number, area, evaluador, created_at, es_baja, fecha_baja')
      .eq('plant_id', plantId)
      .order('nombre')
      .then(({ data }) => setEmployees(data || []));
  }, [plantId]);

  useEffect(() => {
    if (!recordId) return;
    (async () => {
      setIsLoading(true);
      try {
        const { data: rec } = await supabase
          .from('ojt_records')
          .select('*, jefe_directo:employees!ojt_records_jefe_directo_id_fkey(nombre)')
          .eq('id', recordId)
          .maybeSingle();
        if (!rec) return;
        setCurrentRecordId(rec.id);
        setTitulo(rec.titulo ?? '');
        setPuesto(rec.puesto ?? '');
        setPeriodo(rec.periodo_entrenamiento ?? '');
        setEsPiloto(rec.es_piloto_proceso ?? false);
        setPilotoCodigo(rec.piloto_proceso_codigo ?? '');
        setEsBrigada(rec.es_integrante_brigada ?? false);

        const { data: secs } = await supabase
          .from('ojt_sections')
          .select('*, entries:ojt_entries(*)')
          .eq('record_id', recordId)
          .order('orden');

        setSections(
          (secs || []).map((s: any) => ({
            ...s,
            entries: [...(s.entries || [])].sort((a: OjtEntry, b: OjtEntry) => a.orden - b.orden),
          }))
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [recordId]);

  const handleExportTemplate = async () => {
    if (!currentRecordId) return;
    setIsExporting(true);
    try {
      const templateRecord = {
        id: currentRecordId,
        titulo: titulo || null,
        puesto: puesto || null,
        periodo_entrenamiento: periodo || null,
        es_piloto_proceso: esPiloto,
        piloto_proceso_codigo: pilotoCodigo || null,
        es_integrante_brigada: esBrigada,
        is_template: true,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const groups: PdfSectionGroup[] = sections.map((sec) => ({
        section_id: sec.id,
        section_nombre: sec.nombre,
        tipo: sec.tipo,
        orden: sec.orden,
        rows: sec.entries.map((entry): PdfInstanceRow => ({
          entry_id: entry.id,
          conocimiento_requerido: entry.conocimiento_requerido ?? null,
          habilidades: entry.habilidades ?? null,
          fuentes_informacion: entry.fuentes_informacion ?? null,
          procedimientos_internos: entry.procedimientos_internos ?? null,
          metodo_entrenamiento: entry.metodo_entrenamiento ?? null,
          duracion: entry.duracion ?? null,
          puesto_responsable: entry.puesto_responsable ?? null,
          fecha_planeada_terminacion: entry.fecha_planeada_terminacion ?? null,
          fecha_real_inicio: '',
          fecha_real_termino: '',
          efectividad: '',
          empleado_firma_url: null,
          responsable_nombre: '',
          responsable_firma_url: null,
          comentarios: '',
        })),
      }));

      const safe = (titulo || 'OJT').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const fecha = new Date().toISOString().split('T')[0];

      await generateOjtInstancePdf({
        template: templateRecord as any,
        jefeNombre: '—',
        nombre: '',
        fechaInicio: '',
        fechaTermino: '',
        avgEfectividad: null,
        groups,
        sigNames: { empleado: '', jefe_directo: '', recursos_humanos: '' },
        sigDates: { empleado: '', jefe_directo: '', recursos_humanos: '' },
        sigUrls: { empleado: '', jefe_directo: '', recursos_humanos: '' },
      });
      toast({ title: 'Plantilla exportada', description: `OJT_${safe}_${fecha}.pdf descargado` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo exportar el PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        titulo: titulo || null,
        puesto: puesto || null,
        periodo_entrenamiento: periodo || null,
        es_piloto_proceso: esPiloto,
        piloto_proceso_codigo: esPiloto ? (pilotoCodigo || null) : null,
        es_integrante_brigada: esBrigada,
        is_template: true,
        updated_at: new Date().toISOString(),
      };
      if (currentRecordId) {
        const { error } = await supabase.from('ojt_records').update(payload).eq('id', currentRecordId);
        if (error) throw error;
        toast({ title: 'Guardado', description: 'Plantilla actualizada correctamente' });
      } else {
        const { data: ins, error } = await supabase
          .from('ojt_records')
          .insert([{ ...payload, status: 'draft', plant_id: plantId || null }])
          .select()
          .single();
        if (error) throw error;
        const newId = ins.id;
        setCurrentRecordId(newId);
        const { data: sec } = await supabase
          .from('ojt_sections')
          .insert([{ record_id: newId, tipo: 'conocimientos_generales', nombre: 'Conocimientos Generales', orden: 0 }])
          .select().single();
        if (sec) {
          const defaultEntries = [
            {
              section_id: sec.id,
              orden: 1,
              conocimiento_requerido: 'Comprender el Reglamento Interior de Trabajo, así como las consecuencias del incumplimiento.',
              habilidades: 'Responsabilidad y ética laboral',
              fuentes_informacion: 'Reglamento Interior de Trabajo de Demo Technic',
              procedimientos_internos: 'Reglamento Interior de Trabajo de Demo Technic',
              metodo_entrenamiento: 'Plática informativa en inducción',
              duracion: '2 hrs',
              fecha_planeada_terminacion: null,
              puesto_responsable: null,
            },
            {
              section_id: sec.id,
              orden: 2,
              conocimiento_requerido: 'Conocer e identificar las políticas de la empresa',
              habilidades: 'Seguimiento a lineamientos',
              fuentes_informacion: 'Tableros, Inducción',
              procedimientos_internos: 'Tableros, Inducción',
              metodo_entrenamiento: 'Inducción general',
              duracion: '3 hrs',
              fecha_planeada_terminacion: null,
              puesto_responsable: null,
            },
            {
              section_id: sec.id,
              orden: 3,
              conocimiento_requerido: 'Conocer el registro y funcionamiento del sistema de mejora continua y el correcto registro de ideas',
              habilidades: 'Análisis y propuestas de mejoras',
              fuentes_informacion: 'Sistema Pii: http://10.33.250.35/',
              procedimientos_internos: 'Ejercicio práctico',
              metodo_entrenamiento: 'Plática informativa en inducción',
              duracion: '2 hrs',
              fecha_planeada_terminacion: null,
              puesto_responsable: null,
            },
            {
              section_id: sec.id,
              orden: 4,
              conocimiento_requerido: 'Saber acceder, consultar y utilizar correctamente la plataforma DSGC para la consulta y aplicación de procedimientos, instrucciones y formatos',
              habilidades: 'Búsqueda y consulta de información',
              fuentes_informacion: 'Plataforma DSGC: http://10.33.250.47:84/html/Documentos%20SGC.html',
              procedimientos_internos: 'Plataforma DSGC',
              metodo_entrenamiento: 'Demostración paso a paso',
              duracion: '2 hrs',
              fecha_planeada_terminacion: null,
              puesto_responsable: null,
            },
            {
              section_id: sec.id,
              orden: 5,
              conocimiento_requerido: 'Reglas de seguridad y uso de EPP',
              habilidades: 'Identificación de riesgos, uso adecuado del EPP, cumplimiento de normas de seguridad',
              fuentes_informacion: 'Inducción en seguridad',
              procedimientos_internos: 'Inducción en seguridad, señalamientos',
              metodo_entrenamiento: 'Inducción en seguridad y recorrido en planta',
              duracion: '3 hrs',
              fecha_planeada_terminacion: null,
              puesto_responsable: null,
            },
            {
              section_id: sec.id,
              orden: 6,
              conocimiento_requerido: 'Comprender y aplicar los principios de 5S para mantener un área de trabajo limpia, ordenada y segura.',
              habilidades: 'Organización, disciplina',
              fuentes_informacion: 'Inducción en Lean Manufacturing',
              procedimientos_internos: 'Inducción en Lean Manufacturing',
              metodo_entrenamiento: 'Ejemplos visuales (antes/después)',
              duracion: '1 hr',
              fecha_planeada_terminacion: null,
              puesto_responsable: null,
            },
          ];
          const { data: insertedEntries } = await supabase
            .from('ojt_entries')
            .insert(defaultEntries)
            .select();
          setSections([{ ...sec, entries: insertedEntries || [] }]);
        }
        router.push(`/ojt/${newId}`);
        return;
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveEntryField = useCallback(async (entry: OjtEntry, field: keyof OjtEntry, value: string) => {
    if (!entry.id) {
      const { data: ins } = await supabase
        .from('ojt_entries')
        .insert([{ section_id: entry.section_id, orden: entry.orden, [field]: value || null }])
        .select().single();
      if (ins) {
        setSections(prev => prev.map(s => ({
          ...s,
          entries: s.entries.map(e => e === entry ? { ...e, id: ins.id, [field]: value } : e),
        })));
      }
    } else {
      await supabase.from('ojt_entries')
        .update({ [field]: value || null, updated_at: new Date().toISOString() })
        .eq('id', entry.id);
    }
  }, []);

  const updateEntryLocal = (sId: string, idx: number, field: keyof OjtEntry, value: string) =>
    setSections(prev => prev.map(s => s.id !== sId ? s : {
      ...s, entries: s.entries.map((e, i) => i === idx ? { ...e, [field]: value } : e),
    }));

  const addEntry = async (sId: string) => {
    const sec = sections.find(s => s.id === sId);
    if (!sec) return;
    const { data, error } = await supabase.from('ojt_entries').insert([{ section_id: sId, orden: sec.entries.length }]).select().single();
    if (error) { toast({ title: 'Error', description: 'No se pudo agregar la fila', variant: 'destructive' }); return; }
    setSections(prev => prev.map(s => s.id === sId ? { ...s, entries: [...s.entries, data] } : s));
  };

  const deleteEntry = async (sId: string, entry: OjtEntry) => {
    if (entry.id) {
      const { error } = await supabase.from('ojt_entries').delete().eq('id', entry.id);
      if (error) { toast({ title: 'Error', description: 'No se pudo eliminar la fila', variant: 'destructive' }); return; }
    }
    setSections(prev => prev.map(s => s.id !== sId ? s : { ...s, entries: s.entries.filter(e => e !== entry) }));
  };

  const addActivity = async () => {
    if (!currentRecordId) {
      toast({ title: 'Guarda primero', description: 'Guarda los datos generales antes de agregar actividades', variant: 'destructive' });
      return;
    }
    const actCount = sections.filter(s => s.tipo === 'actividad').length;
    const { data: sec, error } = await supabase
      .from('ojt_sections')
      .insert([{ record_id: currentRecordId, tipo: 'actividad', nombre: `Actividad ${actCount + 1}`, orden: sections.length }])
      .select().single();
    if (error) { toast({ title: 'Error', description: 'No se pudo agregar actividad', variant: 'destructive' }); return; }
    const { data: ent } = await supabase.from('ojt_entries').insert([{ section_id: sec.id, orden: 0 }]).select().single();
    setSections(prev => [...prev, { ...sec, entries: ent ? [ent] : [] }]);
  };

  const deleteSection = async (sId: string) => {
    const { error } = await supabase.from('ojt_sections').delete().eq('id', sId);
    if (error) { toast({ title: 'Error', description: 'No se pudo eliminar la actividad', variant: 'destructive' }); return; }
    setSections(prev => prev.filter(s => s.id !== sId));
  };

  const updateSectionName = async (sId: string, nombre: string) => {
    setSections(prev => prev.map(s => s.id === sId ? { ...s, nombre } : s));
    await supabase.from('ojt_sections').update({ nombre }).eq('id', sId);
  };

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" /><div className="h-32 bg-muted rounded" /><div className="h-64 bg-muted rounded" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-2">
        {currentRecordId && (
          <Button
            variant="outline"
            onClick={handleExportTemplate}
            disabled={isExporting}
            className="border-[#2166be] text-[#2166be] hover:bg-[#2166be]/5"
          >
            <FileDown className="w-4 h-4 mr-2" />
            {isExporting ? 'Generando PDF...' : 'Exportar plantilla vacía'}
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Guardando...' : 'Guardar plantilla'}
        </Button>
      </div>

      {/* Datos Generales */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Datos Generales de la Plantilla
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">Nombre del Entrenamiento</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nombre del entrenamiento" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Puesto</Label>
            <Input value={puesto} onChange={e => setPuesto(e.target.value)} placeholder="Puesto de trabajo" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período de Entrenamiento</Label>
            <Input value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="Ej: Semana 1–4" className="h-9 text-sm" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-5">
              <Checkbox id="piloto" checked={esPiloto} onCheckedChange={v => { setEsPiloto(!!v); if (!v) setPilotoCodigo(''); }} />
              <Label htmlFor="piloto" className="text-sm cursor-pointer">¿Es Piloto de Proceso?</Label>
            </div>
            {esPiloto && (
              <Select value={pilotoCodigo} onValueChange={setPilotoCodigo}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Seleccionar proceso..." />
                </SelectTrigger>
                <SelectContent>
                  {PILOTO_OPTIONS.map(o => (
                    <SelectItem key={o.code} value={o.code} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="brigada" checked={esBrigada} onCheckedChange={v => setEsBrigada(!!v)} />
            <Label htmlFor="brigada" className="text-sm cursor-pointer">¿Es Integrante de Brigada?</Label>
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Conocimientos y Actividades
        </h2>
        {currentRecordId ? (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full border-collapse text-xs" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="bg-muted">
                  {ENTRY_COLS.map(col => (
                    <th key={col.key} className="border border-border px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap" style={{ minWidth: col.minW }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="border border-border px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {sections.map(section => (
                  <React.Fragment key={section.id}>
                    <tr className="bg-[#192b52]/5">
                      <td colSpan={ENTRY_COLS.length + 1} className="border border-border px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {section.tipo === 'actividad' ? (
                            <input
                              className="font-semibold text-foreground bg-transparent border-none outline-none w-full text-xs"
                              value={section.nombre}
                              onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, nombre: e.target.value } : s))}
                              onBlur={e => updateSectionName(section.id, e.target.value)}
                            />
                          ) : (
                            <span className="font-semibold text-foreground text-xs uppercase tracking-wide">{section.nombre}</span>
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => addEntry(section.id)} className="text-[#2166be] hover:text-[#1a5299] text-xs font-medium flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Agregar fila
                            </button>
                            {section.tipo === 'actividad' && (
                              <button type="button" onClick={() => deleteSection(section.id)} className="text-red-500 hover:text-red-700 ml-1" title="Eliminar actividad">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {section.entries.map((entry, idx) => (
                      <tr key={entry.id || `new-${idx}`} className="hover:bg-muted/30">
                        {ENTRY_COLS.map(col => {
                          const rawVal = (entry[col.key] as string) ?? '';
                          const extractedUrls = col.key === 'fuentes_informacion' 
                            ? (rawVal.match(/https?:\/\/[^\s]+/g) || []) 
                            : [];
                          return (
                            <td key={col.key} className="border border-border px-1 py-0.5">
                              <div className="flex items-start gap-0.5">
                                <textarea
                                  value={rawVal}
                                  onChange={e => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                    updateEntryLocal(section.id, idx, col.key, e.target.value);
                                  }}
                                  onFocus={e => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                  }}
                                  onBlur={e => {
                                    e.target.style.height = '28px';
                                    saveEntryField(entry, col.key, e.target.value);
                                  }}
                                  className="w-full min-h-[28px] px-1.5 py-1 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded resize-none overflow-hidden"
                                  style={{ minWidth: col.minW, height: '28px' }}
                                />
                                {extractedUrls.length > 0 && (
                                  <div className="flex flex-col gap-1.5 pt-1 shrink-0">
                                    {extractedUrls.map((url, uIdx) => (
                                      <a
                                        key={uIdx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Abrir: ${url}`}
                                        className="text-[#2166be] hover:text-[#1a5299] transition-colors"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-border px-1 py-0.5 text-center">
                          <button type="button" onClick={() => deleteEntry(section.id, entry)} className="text-red-400 hover:text-red-600" title="Eliminar fila">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Guarda los datos generales primero para habilitar la tabla de entrenamiento.</p>
        )}
        {currentRecordId && (
          <div className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={addActivity} className="text-[#2166be] border-[#2166be] hover:bg-[#2166be]/5">
              <Plus className="w-4 h-4 mr-1" /> Agregar Actividad
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { OjtEmployeeSelect } from '@/components/ojt-employee-select';
import {
  supabase,
  Employee,
  OjtRecord,
  OjtEntry,
  OjtSection,
  OjtSectionWithEntries,
  OjtSignature,
} from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { generateOjtPdf } from '@/lib/ojt-pdf';

interface OjtFormProps {
  recordId: string | null;
}

// ─── Status badge helper ───────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'En Progreso',
  completed: 'Completado',
  locked: 'Bloqueado',
};
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  locked: 'bg-red-100 text-red-800 border-red-200',
};

// ─── Column definitions ────────────────────────────────────────────────────
const ENTRY_COLUMNS: Array<{ key: keyof OjtEntry; label: string; type: string; minW: string }> = [
  { key: 'conocimiento_requerido', label: 'Conocimiento Requerido', type: 'text', minW: '160px' },
  { key: 'habilidades', label: 'Habilidades', type: 'text', minW: '140px' },
  { key: 'fuentes_informacion', label: 'Fuentes de Información', type: 'text', minW: '160px' },
  { key: 'procedimientos_internos', label: 'Procedimientos Internos', type: 'text', minW: '170px' },
  { key: 'metodo_entrenamiento', label: 'Método de Entrenamiento', type: 'text', minW: '170px' },
  { key: 'duracion', label: 'Duración', type: 'text', minW: '100px' },
  { key: 'fecha_planeada_terminacion', label: 'F. Planeada Terminación', type: 'date', minW: '160px' },
  { key: 'fecha_real_inicio', label: 'F. Real Inicio', type: 'date', minW: '140px' },
  { key: 'fecha_real_termino', label: 'F. Real Término', type: 'date', minW: '140px' },
  { key: 'responsable_entrenamiento', label: 'Responsable Entrenamiento', type: 'text', minW: '170px' },
  { key: 'firma_empleado', label: 'Firma Empleado', type: 'text', minW: '140px' },
  { key: 'comentarios', label: 'Comentarios', type: 'text', minW: '160px' },
];

// ─── Empty entry factory ────────────────────────────────────────────────────
function emptyEntry(sectionId: string, orden: number): OjtEntry {
  return {
    id: '',
    section_id: sectionId,
    orden,
    conocimiento_requerido: null,
    habilidades: null,
    fuentes_informacion: null,
    procedimientos_internos: null,
    metodo_entrenamiento: null,
    duracion: null,
    fecha_planeada_terminacion: null,
    fecha_real_inicio: null,
    fecha_real_termino: null,
    responsable_entrenamiento: null,
    firma_empleado: null,
    firma_empleado_at: null,
    comentarios: null,
    created_at: '',
    updated_at: '',
  };
}

export function OjtForm({ recordId }: OjtFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!recordId);

  const [currentRecordId, setCurrentRecordId] = useState<string | null>(recordId);
  const [status, setStatus] = useState<OjtRecord['status']>('draft');
  const [titulo, setTitulo] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeLabel, setEmployeeLabel] = useState('');
  const [nombre, setNombre] = useState('');
  const [puesto, setPuesto] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [pilotoProceso, setPilotoProceso] = useState('');
  const [pilotoProcesoLabel, setPilotoProcesoLabel] = useState('');
  const [periodoEntrenamiento, setPeriodoEntrenamiento] = useState('');
  const [jefeDirectoId, setJefeDirectoId] = useState<string | null>(null);
  const [jefeDirectoLabel, setJefeDirectoLabel] = useState('');
  const [integranteBrigadaId, setIntegranteBrigadaId] = useState<string | null>(null);
  const [integranteBrigadaLabel, setIntegranteBrigadaLabel] = useState('');

  const [sections, setSections] = useState<OjtSectionWithEntries[]>([]);

  const [signatures, setSignatures] = useState<Record<string, OjtSignature>>({});
  const [sigNames, setSigNames] = useState<Record<string, string>>({
    empleado: '',
    jefe_directo: '',
    recursos_humanos: '',
  });
  const [sigDates, setSigDates] = useState<Record<string, string>>({
    empleado: '',
    jefe_directo: '',
    recursos_humanos: '',
  });

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, nombre, puesto, employee_number, area, evaluador, created_at')
      .order('nombre')
      .then(({ data }) => setEmployees(data || []));
  }, []);

  useEffect(() => {
    if (!recordId) return;

    const loadRecord = async () => {
      setIsLoading(true);
      try {
        const { data: rec, error: recErr } = await supabase
          .from('ojt_records')
          .select(`
            *,
            employee:employees!ojt_records_employee_id_fkey(nombre, puesto),
            jefe_directo:employees!ojt_records_jefe_directo_id_fkey(nombre),
            integrante_brigada:employees!ojt_records_integrante_brigada_id_fkey(nombre)
          `)
          .eq('id', recordId)
          .maybeSingle();

        if (recErr) throw recErr;
        if (!rec) return;

        setCurrentRecordId(rec.id);
        setStatus(rec.status);
        setTitulo(rec.titulo ?? '');
        setEmployeeId(rec.employee_id);
        setEmployeeLabel((rec as any).employee?.nombre ?? '');
        setNombre(rec.nombre ?? '');
        setPuesto(rec.puesto ?? '');
        setFechaInicio(rec.fecha_inicio ?? '');
        setFechaTermino(rec.fecha_termino ?? '');
        setPilotoProceso(rec.piloto_proceso ?? '');
        setPilotoProcesoLabel(rec.piloto_proceso ?? '');
        setPeriodoEntrenamiento(rec.periodo_entrenamiento ?? '');
        setJefeDirectoId(rec.jefe_directo_id);
        setJefeDirectoLabel((rec as any).jefe_directo?.nombre ?? '');
        setIntegranteBrigadaId(rec.integrante_brigada_id);
        setIntegranteBrigadaLabel((rec as any).integrante_brigada?.nombre ?? '');

        const { data: secs, error: secsErr } = await supabase
          .from('ojt_sections')
          .select('*, entries:ojt_entries(*)')
          .eq('record_id', recordId)
          .order('orden');

        if (secsErr) throw secsErr;

        const normalized: OjtSectionWithEntries[] = (secs || []).map((s: any) => ({
          ...s,
          entries: [...(s.entries || [])].sort((a: OjtEntry, b: OjtEntry) => a.orden - b.orden),
        }));
        setSections(normalized);

        const { data: sigs } = await supabase
          .from('ojt_signatures')
          .select('*')
          .eq('record_id', recordId);

        const sigMap: Record<string, OjtSignature> = {};
        const names: Record<string, string> = { empleado: '', jefe_directo: '', recursos_humanos: '' };
        const dates: Record<string, string> = { empleado: '', jefe_directo: '', recursos_humanos: '' };
        (sigs || []).forEach((s: OjtSignature) => {
          sigMap[s.signer_type] = s;
          names[s.signer_type] = s.signer_name ?? '';
          dates[s.signer_type] = s.signed_at ?? '';
        });
        setSignatures(sigMap);
        setSigNames(names);
        setSigDates(dates);
      } catch (err) {
        toast({ title: 'Error', description: 'No se pudo cargar el registro', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    loadRecord();
  }, [recordId]);

  const hasAnyData = () => {
    return !!(
      titulo || employeeId || nombre || puesto || fechaInicio || fechaTermino ||
      pilotoProceso || periodoEntrenamiento || jefeDirectoId || integranteBrigadaId
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newStatus: OjtRecord['status'] = status === 'draft' && hasAnyData() ? 'in_progress' : status;
      const payload = {
        titulo: titulo || null,
        employee_id: employeeId,
        nombre: nombre || null,
        puesto: puesto || null,
        fecha_inicio: fechaInicio || null,
        fecha_termino: fechaTermino || null,
        piloto_proceso: pilotoProceso || null,
        periodo_entrenamiento: periodoEntrenamiento || null,
        jefe_directo_id: jefeDirectoId,
        integrante_brigada_id: integranteBrigadaId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (currentRecordId) {
        const { error } = await supabase
          .from('ojt_records')
          .update(payload)
          .eq('id', currentRecordId);
        if (error) throw error;
        setStatus(newStatus);
      } else {
        const { data: inserted, error } = await supabase
          .from('ojt_records')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        const newId = inserted.id;
        setCurrentRecordId(newId);
        setStatus(newStatus);

        const { data: sec, error: secErr } = await supabase
          .from('ojt_sections')
          .insert([{ record_id: newId, tipo: 'conocimientos_generales', nombre: 'Conocimientos Generales', orden: 0 }])
          .select()
          .single();
        if (secErr) throw secErr;

        await supabase.from('ojt_entries').insert([{ section_id: sec.id, orden: 0 }]);

        router.push(`/ojt/${newId}`);
        return;
      }

      toast({ title: 'Guardado', description: 'Registro actualizado correctamente' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  const saveEntryField = useCallback(
    async (entry: OjtEntry, field: keyof OjtEntry, value: string) => {
      if (!entry.id) {
        const { data: inserted, error } = await supabase
          .from('ojt_entries')
          .insert([{ section_id: entry.section_id, orden: entry.orden, [field]: value || null }])
          .select()
          .single();
        if (error) { console.error(error); return; }
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            entries: s.entries.map((e) =>
              e === entry ? { ...e, id: inserted.id, [field]: value } : e
            ),
          }))
        );
      } else {
        await supabase
          .from('ojt_entries')
          .update({ [field]: value || null, updated_at: new Date().toISOString() })
          .eq('id', entry.id);
      }
    },
    []
  );

  const updateEntryLocal = (sectionId: string, entryIdx: number, field: keyof OjtEntry, value: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, entries: s.entries.map((e, i) => (i === entryIdx ? { ...e, [field]: value } : e)) }
      )
    );
  };

  const addEntry = async (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const orden = section.entries.length;
    const { data, error } = await supabase
      .from('ojt_entries')
      .insert([{ section_id: sectionId, orden }])
      .select()
      .single();
    if (error) { toast({ title: 'Error', description: 'No se pudo agregar la fila', variant: 'destructive' }); return; }
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, entries: [...s.entries, data] } : s))
    );
  };

  const deleteEntry = async (sectionId: string, entry: OjtEntry) => {
    if (entry.id) {
      const { error } = await supabase.from('ojt_entries').delete().eq('id', entry.id);
      if (error) { toast({ title: 'Error', description: 'No se pudo eliminar la fila', variant: 'destructive' }); return; }
    }
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : { ...s, entries: s.entries.filter((e) => e !== entry) }
      )
    );
  };
  const addActivity = async () => {
    if (!currentRecordId) {
      toast({ title: 'Guarda primero el registro', description: 'Guarda los datos generales antes de agregar actividades', variant: 'destructive' });
      return;
    }
    const activityCount = sections.filter((s) => s.tipo === 'actividad').length;
    const orden = sections.length;
    const nombre = `Actividad ${activityCount + 1}`;

    const { data: sec, error: secErr } = await supabase
      .from('ojt_sections')
      .insert([{ record_id: currentRecordId, tipo: 'actividad', nombre, orden }])
      .select()
      .single();
    if (secErr) { toast({ title: 'Error', description: 'No se pudo agregar la actividad', variant: 'destructive' }); return; }

    const { data: entry } = await supabase
      .from('ojt_entries')
      .insert([{ section_id: sec.id, orden: 0 }])
      .select()
      .single();

    setSections((prev) => [...prev, { ...sec, entries: entry ? [entry] : [] }]);
  };

  const deleteSection = async (sectionId: string) => {
    const { error } = await supabase.from('ojt_sections').delete().eq('id', sectionId);
    if (error) { toast({ title: 'Error', description: 'No se pudo eliminar la actividad', variant: 'destructive' }); return; }
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const updateSectionName = async (sectionId: string, nombre: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, nombre } : s))
    );
    await supabase.from('ojt_sections').update({ nombre }).eq('id', sectionId);
  };

  const saveSignature = async (signerType: 'empleado' | 'jefe_directo' | 'recursos_humanos') => {
    if (!currentRecordId) return;
    const existing = signatures[signerType];
    const payload = {
      record_id: currentRecordId,
      signer_type: signerType,
      signer_name: sigNames[signerType] || null,
      signed_at: sigDates[signerType] || null,
    };
    if (existing?.id) {
      await supabase.from('ojt_signatures').update(payload).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('ojt_signatures').insert([payload]).select().single();
      if (data) setSignatures((prev) => ({ ...prev, [signerType]: data }));
    }
  };

  const handleExportPdf = async () => {
    if (!currentRecordId) return;
    setIsExporting(true);
    try {
      await generateOjtPdf({
        titulo,
        nombre,
        puesto,
        fechaInicio,
        fechaTermino,
        pilotoProceso,
        periodoEntrenamiento,
        jefeDirectoLabel,
        integranteBrigadaLabel,
        sections,
        sigNames,
        sigDates,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: 'No se pudo generar el PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  const isLocked = status === 'locked';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          {titulo && (
            <span className="text-sm font-medium text-foreground truncate max-w-xs">{titulo}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentRecordId && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="gap-2"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? 'Generando...' : 'Exportar PDF'}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || isLocked}
            className="bg-[#2166be] hover:bg-[#1a5299] text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Datos Generales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Titulo */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">Nombre del Entrenamiento</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nombre del entrenamiento"
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Empleado</Label>
            <OjtEmployeeSelect
              value={employeeLabel}
              placeholder="Buscar empleado..."
              employees={employees}
              onSelect={(emp) => {
                if (emp) {
                  setEmployeeId(emp.id);
                  setEmployeeLabel(emp.nombre);
                  if (!nombre) setNombre(emp.nombre);
                  if (!puesto) setPuesto(emp.puesto);
                } else {
                  setEmployeeId(null);
                  setEmployeeLabel('');
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del empleado"
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Puesto</Label>
            <Input
              value={puesto}
              onChange={(e) => setPuesto(e.target.value)}
              placeholder="Puesto"
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha de Inicio</Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha de Término</Label>
            <Input
              type="date"
              value={fechaTermino}
              onChange={(e) => setFechaTermino(e.target.value)}
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Piloto de Proceso</Label>
            <OjtEmployeeSelect
              value={pilotoProcesoLabel}
              placeholder="Buscar piloto de proceso..."
              employees={employees}
              onSelect={(emp) => {
                if (emp) {
                  setPilotoProceso(emp.nombre);
                  setPilotoProcesoLabel(emp.nombre);
                } else {
                  setPilotoProceso('');
                  setPilotoProcesoLabel('');
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período de Entrenamiento</Label>
            <Input
              value={periodoEntrenamiento}
              onChange={(e) => setPeriodoEntrenamiento(e.target.value)}
              placeholder="Ej: Semana 1-4"
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Jefe Directo</Label>
            <OjtEmployeeSelect
              value={jefeDirectoLabel}
              placeholder="Buscar jefe directo..."
              employees={employees}
              onSelect={(emp) => {
                if (emp) { setJefeDirectoId(emp.id); setJefeDirectoLabel(emp.nombre); }
                else { setJefeDirectoId(null); setJefeDirectoLabel(''); }
              }}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Integrante de Brigada</Label>
            <OjtEmployeeSelect
              value={integranteBrigadaLabel}
              placeholder="Buscar integrante..."
              employees={employees}
              onSelect={(emp) => {
                if (emp) { setIntegranteBrigadaId(emp.id); setIntegranteBrigadaLabel(emp.nombre); }
                else { setIntegranteBrigadaId(null); setIntegranteBrigadaLabel(''); }
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Plan de Entrenamiento
        </h2>

        {currentRecordId ? (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full border-collapse text-xs" style={{ minWidth: '1600px' }}>
              <thead>
                <tr className="bg-muted">
                  {ENTRY_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="border border-border px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap"
                      style={{ minWidth: col.minW }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="border border-border px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <React.Fragment key={section.id}>
                    <tr className="bg-[#192b52]/5">
                      <td
                        colSpan={ENTRY_COLUMNS.length + 1}
                        className="border border-border px-3 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {section.tipo === 'actividad' ? (
                            <input
                              className="font-semibold text-foreground bg-transparent border-none outline-none w-full text-xs"
                              value={section.nombre}
                              onChange={(e) =>
                                setSections((prev) =>
                                  prev.map((s) => s.id === section.id ? { ...s, nombre: e.target.value } : s)
                                )
                              }
                              onBlur={(e) => updateSectionName(section.id, e.target.value)}
                              disabled={isLocked}
                            />
                          ) : (
                            <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                              {section.nombre}
                            </span>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => addEntry(section.id)}
                              disabled={isLocked}
                              className="text-[#2166be] hover:text-[#1a5299] text-xs font-medium flex items-center gap-1 disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                              Agregar fila
                            </button>
                            {section.tipo === 'actividad' && !isLocked && (
                              <button
                                type="button"
                                onClick={() => deleteSection(section.id)}
                                className="text-red-500 hover:text-red-700 ml-2"
                                title="Eliminar actividad"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {section.entries.map((entry, idx) => (
                      <tr key={entry.id || `new-${idx}`} className="hover:bg-muted/30">
                        {ENTRY_COLUMNS.map((col) => (
                          <td key={col.key} className="border border-border px-1 py-0.5">
                            <input
                              type={col.type}
                              value={(entry[col.key] as string) ?? ''}
                              disabled={isLocked}
                              onChange={(e) => updateEntryLocal(section.id, idx, col.key, e.target.value)}
                              onBlur={(e) => saveEntryField(entry, col.key, e.target.value)}
                              className="w-full h-7 px-1.5 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded disabled:opacity-50"
                              style={{ minWidth: col.minW }}
                            />
                          </td>
                        ))}
                        <td className="border border-border px-1 py-0.5 text-center">
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => deleteEntry(section.id, entry)}
                              className="text-red-400 hover:text-red-600"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Guarda los datos generales primero para habilitar la tabla de entrenamiento.
          </p>
        )}

        {currentRecordId && !isLocked && (
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addActivity}
              className="text-[#2166be] border-[#2166be] hover:bg-[#2166be]/5"
            >
              <Plus className="w-4 h-4 mr-1" />
              Agregar Actividad
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Firmas de Liberación
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {(['empleado', 'jefe_directo', 'recursos_humanos'] as const).map((sigType) => {
            const labels: Record<string, string> = {
              empleado: 'Empleado',
              jefe_directo: 'Jefe Directo',
              recursos_humanos: 'Recursos Humanos',
            };
            return (
              <div key={sigType} className="space-y-3 border border-border rounded-md p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {labels[sigType]}
                </p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nombre</Label>
                  <Input
                    value={sigNames[sigType]}
                    onChange={(e) => setSigNames((prev) => ({ ...prev, [sigType]: e.target.value }))}
                    onBlur={() => saveSignature(sigType)}
                    placeholder="Nombre completo"
                    disabled={isLocked || !currentRecordId}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fecha de Firma</Label>
                  <Input
                    type="date"
                    value={sigDates[sigType]}
                    onChange={(e) => setSigDates((prev) => ({ ...prev, [sigType]: e.target.value }))}
                    onBlur={() => saveSignature(sigType)}
                    disabled={isLocked || !currentRecordId}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

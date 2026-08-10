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
import { useToast } from '@/hooks/use-toast';
import { generateOjtInstancePdf } from '@/lib/ojt-pdf';
import type { PdfSectionGroup, PdfInstanceRow } from '@/lib/ojt-pdf';
import type { Employee, OjtEntry, OjtSectionWithEntries, OjtRecord } from '@/types/database';

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
    fetch(`/employees/data?plant_id=${plantId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(json => setEmployees(json.employees || []))
      .catch(err => console.error('Error loading employees:', err));
  }, [plantId]);

  useEffect(() => {
    if (!recordId) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/ojt/records?id=${recordId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Error al cargar plantilla');
        const json = await res.json();
        const rec = json.record;

        if (rec) {
          setCurrentRecordId(rec.id);
          setTitulo(rec.titulo ?? '');
          setPuesto(rec.puesto ?? '');
          setPeriodo(rec.periodo_entrenamiento ?? '');
          setEsPiloto(rec.es_piloto_proceso ?? false);
          setPilotoCodigo(rec.piloto_proceso_codigo ?? '');
          setEsBrigada(rec.es_integrante_brigada ?? false);

          setSections(
            (json.sections || []).map((s: any) => ({
              id: s.id,
              record_id: s.record_id,
              tipo: s.tipo,
              nombre: s.nombre,
              orden: s.orden,
              created_at: s.created_at,
              updated_at: s.updated_at,
              entries: (s.entries || []).map((e: any) => ({
                id: e.id,
                section_id: e.section_id,
                orden: e.orden,
                conocimiento_requerido: e.conocimiento_requerido,
                habilidades: e.habilidades,
                fuentes_informacion: e.fuentes_informacion,
                procedimientos_internos: e.procedimientos_internos,
                metodo_entrenamiento: e.metodo_entrenamiento,
                duracion: e.duracion,
                puesto_responsable: e.puesto_responsable,
                created_at: e.created_at,
                updated_at: e.updated_at,
              })),
            }))
          );
        }
      } catch (err: any) {
        console.error('Error loading record:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [recordId]);

  const addSection = (tipo: 'general' | 'especifico') => {
    const isGen = tipo === 'general';
    const numGen = sections.filter(s => s.tipo === 'general').length;
    const numEsp = sections.filter(s => s.tipo === 'especifico').length;

    const defaultName = isGen
      ? `MATRIZ GENERAL DE ENTRENAMIENTO ${numGen + 1}`
      : `MATRIZ ESPECÍFICA DE ENTRENAMIENTO ${numEsp + 1}`;

    const newSec: OjtSectionWithEntries = {
      id: `new_${Date.now()}_${Math.random()}`,
      record_id: currentRecordId ?? '',
      tipo,
      nombre: defaultName,
      orden: sections.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      entries: [],
    };
    setSections(prev => [...prev, newSec]);
  };

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const updateSectionName = (sectionId: string, nombre: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, nombre } : s));
  };

  const addEntry = (sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const newEnt: OjtEntry = {
        id: `new_${Date.now()}_${Math.random()}`,
        section_id: sectionId,
        orden: s.entries.length,
        conocimiento_requerido: null,
        habilidades: null,
        fuentes_informacion: null,
        procedimientos_internos: null,
        metodo_entrenamiento: null,
        duracion: null,
        puesto_responsable: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { ...s, entries: [...s.entries, newEnt] };
    }));
  };

  const removeEntry = (sectionId: string, entryId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, entries: s.entries.filter(e => e.id !== entryId) };
    }));
  };

  const updateEntryField = (
    sectionId: string, entryId: string, field: keyof OjtEntry, value: string
  ) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        entries: s.entries.map(e => {
          if (e.id !== entryId) return e;
          return { ...e, [field]: value || null };
        }),
      };
    }));
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({ title: 'Campo requerido', description: 'Introduce un título para el OJT', variant: 'destructive' });
      return;
    }
    if (!puesto.trim()) {
      toast({ title: 'Campo requerido', description: 'Introduce el puesto asignado', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/ojt/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentRecordId,
          titulo,
          puesto,
          periodo_entrenamiento: periodo,
          es_piloto_proceso: esPiloto,
          piloto_proceso_codigo: esPiloto ? pilotoCodigo : null,
          es_integrante_brigada: esBrigada,
          plant_id: plantId,
          sections,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Error al guardar la plantilla');
      }

      const json = await response.json();
      setCurrentRecordId(json.id);

      toast({ title: 'Guardado', description: 'La plantilla OJT se guardó correctamente' });
      router.push('/ojt');
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const mockRecord: OjtRecord = {
        id: currentRecordId ?? 'preview',
        plant_id: plantId,
        titulo,
        puesto,
        periodo_entrenamiento: periodo,
        es_piloto_proceso: esPiloto,
        piloto_proceso_codigo: esPiloto ? pilotoCodigo : null,
        es_integrante_brigada: esBrigada,
        jefe_directo_id: null,
        is_template: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const groups: PdfSectionGroup[] = sections.map(s => ({
        section_id: s.id,
        section_nombre: s.nombre || '',
        tipo: s.tipo || '',
        orden: s.orden,
        rows: s.entries.map(e => ({
          entry_id: e.id,
          conocimiento_requerido: e.conocimiento_requerido,
          habilidades: e.habilidades,
          fuentes_informacion: e.fuentes_informacion,
          procedimientos_internos: e.procedimientos_internos,
          metodo_entrenamiento: e.metodo_entrenamiento,
          duracion: e.duracion,
          puesto_responsable: e.puesto_responsable,
          fecha_planeada_terminacion: null,
          fecha_real_inicio: '',
          fecha_real_termino: '',
          efectividad: '',
          responsable_nombre: '',
          responsable_firma_url: null,
          empleado_firma_url: null,
          comentarios: '',
        } as PdfInstanceRow)),
      }));

      await generateOjtInstancePdf({
        template: mockRecord,
        jefeNombre: '',
        nombre: '',
        fechaInicio: '',
        fechaTermino: '',
        avgEfectividad: null,
        groups,
        sigNames: { empleado: '', jefe_directo: '', recursos_humanos: '' },
        sigDates: { empleado: '', jefe_directo: '', recursos_humanos: '' },
        sigUrls: { empleado: '', jefe_directo: '', recursos_humanos: '' },
      });

      toast({ title: 'PDF generado', description: 'La vista previa se descargó correctamente' });
    } catch (err: any) {
      toast({ title: 'Error PDF', description: err.message, variant: 'destructive' });
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

  const renderSectionTable = (s: OjtSectionWithEntries) => (
    <div key={s.id} className="border border-border rounded-md overflow-hidden bg-card mb-6">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border">
        <Input
          value={s.nombre}
          onChange={e => updateSectionName(s.id, e.target.value)}
          className="font-semibold text-sm bg-transparent border-none p-0 h-auto focus:ring-0 text-foreground max-w-lg"
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addEntry(s.id)} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Fila
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => removeSection(s.id)} className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              {ENTRY_COLS.map(col => (
                <th key={col.key} className="border-b border-r border-border px-2 py-2 text-left font-medium text-muted-foreground" style={{ minWidth: col.minW }}>
                  {col.label}
                </th>
              ))}
              <th className="border-b border-border px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {s.entries.length === 0 ? (
              <tr>
                <td colSpan={ENTRY_COLS.length + 1} className="py-6 text-center text-muted-foreground text-xs">
                  Sin filas. Haz clic en <span className="font-semibold text-foreground">+ Fila</span> para agregar.
                </td>
              </tr>
            ) : (
              s.entries.map((e, idx) => (
                <tr key={e.id} className="hover:bg-muted/20">
                  {ENTRY_COLS.map(col => (
                    <td key={col.key} className="border-b border-r border-border p-1">
                      <Input
                        value={(e[col.key] as string) || ''}
                        onChange={ev => updateEntryField(s.id, e.id, col.key, ev.target.value)}
                        placeholder={col.label}
                        className="h-7 text-xs bg-transparent border-none focus:bg-background focus:ring-1 focus:ring-ring rounded-sm px-1.5"
                      />
                    </td>
                  ))}
                  <td className="border-b border-border p-1 text-center">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEntry(s.id, e.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-lg p-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {currentRecordId ? 'Editar Plantilla OJT' : 'Nueva Plantilla OJT'}
          </h1>
          <p className="text-xs text-muted-foreground">Configura las matrices de entrenamiento</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleExportPdf} disabled={isExporting} className="gap-2 text-xs">
            <FileDown className="w-4 h-4" />
            {isExporting ? 'Exportando...' : 'Vista previa PDF'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-[#2166be] hover:bg-[#1a5299] text-white text-xs">
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Guardando...' : 'Guardar Plantilla'}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground pb-2 border-b border-border">Información General</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Título del OJT <span className="text-destructive">*</span></Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Operación de Prensa CNC" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Puesto Asignado <span className="text-destructive">*</span></Label>
            <Input value={puesto} onChange={e => setPuesto(e.target.value)} placeholder="Ej. Operador A" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Período de Entrenamiento</Label>
            <Input value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="Ej. 3 meses" className="h-9 text-sm" />
          </div>
        </div>

        <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-2">
            <Checkbox id="esPiloto" checked={esPiloto} onCheckedChange={v => setEsPiloto(!!v)} />
            <Label htmlFor="esPiloto" className="text-xs cursor-pointer">Piloto de Proceso</Label>
          </div>
          {esPiloto && (
            <div className="space-y-1">
              <Label className="text-xs">Código de Piloto</Label>
              <Select value={pilotoCodigo} onValueChange={setPilotoCodigo}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecciona código..." />
                </SelectTrigger>
                <SelectContent>
                  {PILOTO_OPTIONS.map(opt => (
                    <SelectItem key={opt.code} value={opt.code} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="esBrigada" checked={esBrigada} onCheckedChange={v => setEsBrigada(!!v)} />
            <Label htmlFor="esBrigada" className="text-xs cursor-pointer">Integrante de Brigada</Label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Matrices General y Específica</h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addSection('general')} className="h-8 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Matriz General
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addSection('especifico')} className="h-8 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Matriz Específica
            </Button>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
            Sin secciones agregadas. Usa los botones superiores para añadir una Matriz General o Específica.
          </div>
        ) : (
          sections.map(renderSectionTable)
        )}
      </div>
    </div>
  );
}

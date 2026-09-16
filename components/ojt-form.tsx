"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, FileDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateOjtInstancePdf } from '@/lib/ojt-pdf';
import type { PdfSectionGroup, PdfInstanceRow } from '@/lib/ojt-pdf';
import type { OjtEntry, OjtSectionWithEntries, OjtRecord } from '@/types/database';

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

function createDefaultSections(): OjtSectionWithEntries[] {
  const sectionId = `new_sec_${Date.now()}`;
  return [
    {
      id: sectionId,
      record_id: '',
      tipo: 'conocimientos_generales',
      nombre: 'Conocimientos Generales',
      orden: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      entries: [
        {
          id: `new_ent_1_${Date.now()}`,
          section_id: sectionId,
          orden: 1,
          conocimiento_requerido: 'Comprender el Reglamento Interior de Trabajo, así como las consecuencias del incumplimiento.',
          habilidades: 'Responsabilidad y ética laboral',
          fuentes_informacion: 'Reglamento Interior de Trabajo de Demo Technic',
          procedimientos_internos: 'Reglamento Interior de Trabajo de Demo Technic',
          metodo_entrenamiento: 'Plática informativa en inducción',
          duracion: '2 hrs',
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `new_ent_2_${Date.now()}`,
          section_id: sectionId,
          orden: 2,
          conocimiento_requerido: 'Conocer e identificar las políticas de la empresa',
          habilidades: 'Seguimiento a lineamientos',
          fuentes_informacion: 'Tableros, Inducción',
          procedimientos_internos: 'Tableros, Inducción',
          metodo_entrenamiento: 'Inducción general',
          duracion: '3 hrs',
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `new_ent_3_${Date.now()}`,
          section_id: sectionId,
          orden: 3,
          conocimiento_requerido: 'Conocer el registro y funcionamiento del sistema de mejora continua y el correcto registro de ideas',
          habilidades: 'Análisis y propuestas de mejoras',
          fuentes_informacion: 'Sistema Pii: http://10.33.250.35/',
          procedimientos_internos: 'Ejercicio práctico',
          metodo_entrenamiento: 'Plática informativa en inducción',
          duracion: '2 hrs',
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `new_ent_4_${Date.now()}`,
          section_id: sectionId,
          orden: 4,
          conocimiento_requerido: 'Saber acceder, consultar y utilizar correctamente la plataforma DSGC para la consulta y aplicación de procedimientos, instrucciones y formatos',
          habilidades: 'Búsqueda y consulta de información',
          fuentes_informacion: 'Plataforma DSGC: http://10.33.250.47:84/html/Documentos%20SGC.html',
          procedimientos_internos: 'Plataforma DSGC',
          metodo_entrenamiento: 'Demostración paso a paso',
          duracion: '2 hrs',
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `new_ent_5_${Date.now()}`,
          section_id: sectionId,
          orden: 5,
          conocimiento_requerido: 'Reglas de seguridad y uso de EPP',
          habilidades: 'Identificación de riesgos, uso adecuado del EPP, cumplimiento de normas de seguridad',
          fuentes_informacion: 'Inducción en seguridad',
          procedimientos_internos: 'Inducción en seguridad, señalamientos',
          metodo_entrenamiento: 'Inducción en seguridad y recorrido en planta',
          duracion: '3 hrs',
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `new_ent_6_${Date.now()}`,
          section_id: sectionId,
          orden: 6,
          conocimiento_requerido: 'Comprender y aplicar los principios de 5S para mantener un área de trabajo limpia, ordenada y segura.',
          habilidades: 'Organización, disciplina',
          fuentes_informacion: 'Inducción en Lean Manufacturing',
          procedimientos_internos: 'Inducción en Lean Manufacturing',
          metodo_entrenamiento: 'Ejemplos visuales (antes/después)',
          duracion: '1 hr',
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    },
  ];
}

interface OjtFormProps {
  recordId: string | null;
  plantId: string;
}

export function OjtForm({ recordId, plantId }: OjtFormProps) {
  const router = useRouter();
  const { toast } = useToast();

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
  const [sections, setSections] = useState<OjtSectionWithEntries[]>(() =>
    recordId ? [] : createDefaultSections()
  );

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
              tipo: (s.tipo === 'conocimientos_generales' || s.tipo === 'general')
                ? 'conocimientos_generales'
                : 'actividad',
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

  const addActivity = () => {
    const actCount = sections.filter(s => s.tipo === 'actividad').length;
    const newSecId = `new_sec_${Date.now()}_${Math.random()}`;
    const newSec: OjtSectionWithEntries = {
      id: newSecId,
      record_id: currentRecordId ?? '',
      tipo: 'actividad',
      nombre: `Actividad ${actCount + 1}`,
      orden: sections.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      entries: [
        {
          id: `new_ent_${Date.now()}_${Math.random()}`,
          section_id: newSecId,
          orden: 0,
          conocimiento_requerido: null,
          habilidades: null,
          fuentes_informacion: null,
          procedimientos_internos: null,
          metodo_entrenamiento: null,
          duracion: null,
          puesto_responsable: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };
    setSections(prev => [...prev, newSec]);
  };

  const deleteSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const updateSectionName = (sectionId: string, nombre: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, nombre } : s));
  };

  const addEntry = (sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const newEnt: OjtEntry = {
        id: `new_ent_${Date.now()}_${Math.random()}`,
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

  const deleteEntry = (sectionId: string, entryId: string) => {
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
          return { ...e, [field]: value };
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

  return (
    <div className="space-y-8">
      {/* Barra de Acciones */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleExportPdf}
          disabled={isExporting}
          className="border-[#2166be] text-[#2166be] hover:bg-[#2166be]/5 text-xs"
        >
          <FileDown className="w-4 h-4 mr-1.5" />
          {isExporting ? 'Generando PDF...' : 'Vista previa PDF'}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#2166be] hover:bg-[#1a5299] text-white text-xs"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'Guardando...' : 'Guardar Plantilla'}
        </Button>
      </div>

      {/* Datos Generales de la Plantilla */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Datos Generales de la Plantilla
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">
              Nombre del Entrenamiento <span className="text-destructive">*</span>
            </Label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Nombre del entrenamiento"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Puesto <span className="text-destructive">*</span>
            </Label>
            <Input
              value={puesto}
              onChange={e => setPuesto(e.target.value)}
              placeholder="Puesto de trabajo"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período de Entrenamiento</Label>
            <Input
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              placeholder="Ej: Semana 1–4"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                id="piloto"
                checked={esPiloto}
                onCheckedChange={v => {
                  setEsPiloto(!!v);
                  if (!v) setPilotoCodigo('');
                }}
              />
              <Label htmlFor="piloto" className="text-sm cursor-pointer">
                ¿Es Piloto de Proceso?
              </Label>
            </div>
            {esPiloto && (
              <Select value={pilotoCodigo} onValueChange={setPilotoCodigo}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Seleccionar proceso..." />
                </SelectTrigger>
                <SelectContent>
                  {PILOTO_OPTIONS.map(o => (
                    <SelectItem key={o.code} value={o.code} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2 pt-5">
            <Checkbox
              id="brigada"
              checked={esBrigada}
              onCheckedChange={v => setEsBrigada(!!v)}
            />
            <Label htmlFor="brigada" className="text-sm cursor-pointer">
              ¿Es Integrante de Brigada?
            </Label>
          </div>
        </div>
      </div>

      {/* Tabla Unificada de Conocimientos y Actividades */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Conocimientos y Actividades
        </h2>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full border-collapse text-xs" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="bg-muted">
                {ENTRY_COLS.map(col => (
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
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={ENTRY_COLS.length + 1} className="border border-border py-6 text-center text-muted-foreground text-xs">
                    Sin secciones. Haz clic en <span className="font-semibold text-foreground">Agregar Actividad</span> abajo para comenzar.
                  </td>
                </tr>
              ) : (
                sections.map(section => (
                  <React.Fragment key={section.id}>
                    {/* Fila de cabecera de sección */}
                    <tr className="bg-[#192b52]/5">
                      <td colSpan={ENTRY_COLS.length + 1} className="border border-border px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {section.tipo === 'actividad' ? (
                            <input
                              className="font-semibold text-foreground bg-transparent border-none outline-none w-full text-xs"
                              value={section.nombre || ''}
                              onChange={e => updateSectionName(section.id, e.target.value)}
                              placeholder="Nombre de la actividad..."
                            />
                          ) : (
                            <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                              {section.nombre || 'Conocimientos Generales'}
                            </span>
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => addEntry(section.id)}
                              className="text-[#2166be] hover:text-[#1a5299] text-xs font-medium flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Agregar fila
                            </button>
                            {section.tipo === 'actividad' && (
                              <button
                                type="button"
                                onClick={() => deleteSection(section.id)}
                                className="text-red-500 hover:text-red-700 ml-1"
                                title="Eliminar actividad"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Filas de entries de la sección */}
                    {section.entries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={ENTRY_COLS.length + 1}
                          className="border border-border py-4 text-center text-muted-foreground text-xs"
                        >
                          Sin filas. Haz clic en{' '}
                          <span
                            onClick={() => addEntry(section.id)}
                            className="font-semibold text-[#2166be] cursor-pointer hover:underline"
                          >
                            + Agregar fila
                          </span>{' '}
                          para añadir una.
                        </td>
                      </tr>
                    ) : (
                      section.entries.map((entry, idx) => (
                        <tr key={entry.id || `ent-${idx}`} className="hover:bg-muted/30">
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
                                      updateEntryField(section.id, entry.id, col.key, e.target.value);
                                    }}
                                    onFocus={e => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onBlur={e => {
                                      e.target.style.height = '28px';
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
                            <button
                              type="button"
                              onClick={() => deleteEntry(section.id, entry.id)}
                              className="text-red-400 hover:text-red-600"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Botón para añadir actividades */}
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addActivity}
            className="text-[#2166be] border-[#2166be] hover:bg-[#2166be]/5"
          >
            <Plus className="w-4 h-4 mr-1" /> Agregar Actividad
          </Button>
        </div>
      </div>
    </div>
  );
}

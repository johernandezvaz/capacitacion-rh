"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileDown, Save, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OjtEmployeeSelect } from '@/components/ojt-employee-select';
import { OjtSignatureCanvas } from '@/components/ojt-signature-canvas';
import {
  supabase, Employee, OjtRecord, OjtInstanceSignature,
} from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { generateOjtInstancePdf } from '@/lib/ojt-pdf';

type InstanceEntryRow = {
  entry_id: string;
  conocimiento_requerido: string | null;
  habilidades: string | null;
  fuentes_informacion: string | null;
  procedimientos_internos: string | null;
  metodo_entrenamiento: string | null;
  duracion: string | null;
  puesto_responsable: string | null;
  fecha_planeada_terminacion: string | null;
  instance_entry_id: string | null;
  fecha_real_inicio: string;
  fecha_real_termino: string;
  efectividad: string;
  responsable_nombre: string;
  responsable_firma_url: string | null;
  empleado_firma_url: string | null;
  comentarios: string;
};

type SectionGroup = {
  section_id: string;
  section_nombre: string;
  tipo: string;
  orden: number;
  rows: InstanceEntryRow[];
};

const PILOTO_LABELS: Record<string, string> = {
  P01: 'P01 — Define and Deploy the strategy',
  P02: 'P02 — Manage the safety and environment',
  C02: 'C02 — Fulfill Market Expectation',
  C03: 'C03 — Manage the development of product and process',
  C04: 'C04 — Manufacture ship, invoice and be paid in mass production',
  S01: 'S01 — Manage the suppliers for product and services',
  S05: 'S05 — Perform Physical test and Metrological Measurements',
  S06: 'S06 — Manage Information Technology',
  S09: "S09 — Provide the means and infrastructure and ensure it's reliability",
  S10: 'S10 — Recruit, involve, Motivate and manage the human ressources and their health',
};

interface OjtInstanceFormProps {
  instanceId: string;
  templateId: string;
  plantId?: string | null;
  isPublic?: boolean;
}

export function OjtInstanceForm({ instanceId, templateId, plantId: propPlantId, isPublic }: OjtInstanceFormProps) {
  const { toast } = useToast();
  const { plantId: authPlantId } = useAuth();
  const plantId = propPlantId ?? authPlantId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [template, setTemplate] = useState<OjtRecord | null>(null);
  const [jefeNombre, setJefeNombre] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeLabel, setEmployeeLabel] = useState('');
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');

  const [groups, setGroups] = useState<SectionGroup[]>([]);

  const [signatures, setSignatures] = useState<Record<string, OjtInstanceSignature>>({});
  const [sigNames, setSigNames] = useState({ empleado: '', jefe_directo: '', recursos_humanos: '' });
  const [sigDates, setSigDates] = useState({ empleado: '', jefe_directo: '', recursos_humanos: '' });
  const [sigUrls, setSigUrls] = useState({ empleado: '', jefe_directo: '', recursos_humanos: '' });

  useEffect(() => {
    supabase.from('employees').select('id, nombre, puesto, employee_number, area, evaluador, created_at').order('nombre')
      .then(({ data }) => setEmployees(data || []));
  }, []);

  useEffect(() => {
    if (!instanceId || !templateId) return;
    (async () => {
      setIsLoading(true);
      try {
        const { data: tmpl } = await supabase
          .from('ojt_records')
          .select('*, jefe_directo:employees!ojt_records_jefe_directo_id_fkey(nombre)')
          .eq('id', templateId)
          .maybeSingle();
        setTemplate(tmpl ?? null);
        setJefeNombre((tmpl as any)?.jefe_directo?.nombre ?? '');

        const { data: inst } = await supabase
          .from('ojt_instances')
          .select('*, employees(nombre)')
          .eq('id', instanceId)
          .maybeSingle();
        if (inst) {
          setEmployeeId(inst.employee_id);
          setEmployeeLabel((inst as any).employees?.nombre ?? '');
          setNombre(inst.nombre ?? '');
          setFechaInicio(inst.fecha_inicio ?? '');
          setFechaTermino(inst.fecha_termino ?? '');
        }

        const { data: rows } = await supabase
          .from('ojt_sections')
          .select(`
            id, tipo, nombre, orden,
            ojt_entries (
              id, orden, conocimiento_requerido, habilidades, fuentes_informacion,
              procedimientos_internos, metodo_entrenamiento, duracion, puesto_responsable,
              ojt_instance_entries!ojt_instance_entries_entry_id_fkey (
                id, efectividad, responsable_nombre, responsable_firma_url,
                empleado_firma_url, fecha_planeada_terminacion, fecha_real_inicio, fecha_real_termino, comentarios
              )
            )
          `)
          .eq('record_id', templateId)
          .order('orden');

        const built: SectionGroup[] = (rows || []).map((s: any) => ({
          section_id: s.id,
          section_nombre: s.nombre,
          tipo: s.tipo,
          orden: s.orden,
          rows: [...(s.ojt_entries || [])].sort((a: any, b: any) => a.orden - b.orden).map((e: any) => {
            const ie = (e.ojt_instance_entries || []).find((x: any) => true) ?? null;
            return {
              entry_id: e.id,
              conocimiento_requerido: e.conocimiento_requerido,
              habilidades: e.habilidades,
              fuentes_informacion: e.fuentes_informacion,
              procedimientos_internos: e.procedimientos_internos,
              metodo_entrenamiento: e.metodo_entrenamiento,
              duracion: e.duracion,
              puesto_responsable: e.puesto_responsable ?? null,
              fecha_planeada_terminacion: ie?.fecha_planeada_terminacion ?? '',
              instance_entry_id: ie?.id ?? null,
              fecha_real_inicio: ie?.fecha_real_inicio ?? '',
              fecha_real_termino: ie?.fecha_real_termino ?? '',
              efectividad: ie?.efectividad != null ? String(ie.efectividad) : '',
              responsable_nombre: ie?.responsable_nombre ?? '',
              responsable_firma_url: ie?.responsable_firma_url ?? null,
              empleado_firma_url: ie?.empleado_firma_url ?? null,
              comentarios: ie?.comentarios ?? '',
            } as InstanceEntryRow;
          }),
        }));
        setGroups(built);

        const { data: sigs } = await supabase.from('ojt_instance_signatures').select('*').eq('instance_id', instanceId);
        const sigMap: Record<string, OjtInstanceSignature> = {};
        const names = { empleado: '', jefe_directo: '', recursos_humanos: '' };
        const dates = { empleado: '', jefe_directo: '', recursos_humanos: '' };
        const urls = { empleado: '', jefe_directo: '', recursos_humanos: '' };
        (sigs || []).forEach((s: OjtInstanceSignature) => {
          sigMap[s.signer_type] = s;
          names[s.signer_type as keyof typeof names] = s.signer_name ?? '';
          dates[s.signer_type as keyof typeof dates] = s.signed_at ?? '';
          urls[s.signer_type as keyof typeof urls] = s.firma_url ?? '';
        });
        setSignatures(sigMap);
        setSigNames(names);
        setSigDates(dates);
        setSigUrls(urls);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [instanceId, templateId]);

  const avgEfectividad = useMemo(() => {
    const vals = groups.flatMap(g => g.rows).map(r => parseFloat(r.efectividad)).filter(v => !isNaN(v));
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [groups]);

  const saveInstanceEntryField = useCallback(async (
    groupIdx: number, rowIdx: number, field: string, value: string
  ) => {
    const row = groups[groupIdx].rows[rowIdx];
    const payload: Record<string, any> = {
      [field]: (field === 'efectividad') ? (value ? parseInt(value) : null) : (value || null),
      updated_at: new Date().toISOString(),
    };
    if (row.instance_entry_id) {
      await supabase.from('ojt_instance_entries').update(payload).eq('id', row.instance_entry_id);
    } else {
      const { data: ins } = await supabase.from('ojt_instance_entries')
        .insert([{ instance_id: instanceId, entry_id: row.entry_id, ...payload }])
        .select().single();
      if (ins) {
        setGroups(prev => prev.map((g, gi) => gi !== groupIdx ? g : {
          ...g,
          rows: g.rows.map((r, ri) => ri !== rowIdx ? r : { ...r, instance_entry_id: ins.id }),
        }));
      }
    }
  }, [groups, instanceId]);

  const updateRowLocal = (gIdx: number, rIdx: number, field: string, value: string) =>
    setGroups(prev => prev.map((g, gi) => gi !== gIdx ? g : {
      ...g,
      rows: g.rows.map((r, ri) => ri !== rIdx ? r : { ...r, [field]: value }),
    }));

  const updateRowFirmaUrl = (gIdx: number, rIdx: number, url: string) => {
    setGroups(prev => prev.map((g, gi) => gi !== gIdx ? g : {
      ...g,
      rows: g.rows.map((r, ri) => ri !== rIdx ? r : { ...r, responsable_firma_url: url }),
    }));
    const row = groups[gIdx].rows[rIdx];
    if (row.instance_entry_id) {
      supabase.from('ojt_instance_entries').update({ responsable_firma_url: url }).eq('id', row.instance_entry_id);
    }
  };

  const updateRowEmpleadoFirmaUrl = (gIdx: number, rIdx: number, url: string) => {
    setGroups(prev => prev.map((g, gi) => gi !== gIdx ? g : {
      ...g,
      rows: g.rows.map((r, ri) => ri !== rIdx ? r : { ...r, empleado_firma_url: url }),
    }));
    const row = groups[gIdx].rows[rIdx];
    if (row.instance_entry_id) {
      supabase.from('ojt_instance_entries').update({ empleado_firma_url: url }).eq('id', row.instance_entry_id);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const avg = avgEfectividad;
      await supabase.from('ojt_instances').update({
        employee_id: employeeId,
        nombre: nombre || null,
        fecha_inicio: fechaInicio || null,
        fecha_termino: fechaTermino || null,
        average_efectividad: avg,
        updated_at: new Date().toISOString(),
      }).eq('id', instanceId);
      toast({ title: 'Guardado', description: 'Instancia actualizada correctamente' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSignature = async (type: 'empleado' | 'jefe_directo' | 'recursos_humanos') => {
    const existing = signatures[type];
    const payload = {
      instance_id: instanceId,
      signer_type: type,
      signer_name: sigNames[type] || null,
      signed_at: sigDates[type] || null,
      firma_url: sigUrls[type] || null,
    };
    if (existing?.id) {
      await supabase.from('ojt_instance_signatures').update(payload).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('ojt_instance_signatures').insert([payload]).select().single();
      if (data) setSignatures(prev => ({ ...prev, [type]: data }));
    }
  };

  const updateSigFirmaUrl = async (type: 'empleado' | 'jefe_directo' | 'recursos_humanos', url: string) => {
    setSigUrls(prev => ({ ...prev, [type]: url }));
    const existing = signatures[type];
    const payload = {
      instance_id: instanceId, signer_type: type,
      signer_name: sigNames[type] || null,
      signed_at: sigDates[type] || null,
      firma_url: url,
    };
    if (existing?.id) {
      await supabase.from('ojt_instance_signatures').update(payload).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('ojt_instance_signatures').insert([payload]).select().single();
      if (data) setSignatures(prev => ({ ...prev, [type]: data }));
    }
  };

  const handleExportPdf = async () => {
    if (!template) return;
    setIsExporting(true);
    try {
      await generateOjtInstancePdf({
        template,
        jefeNombre,
        nombre,
        fechaInicio,
        fechaTermino,
        avgEfectividad,
        groups,
        sigNames,
        sigDates,
        sigUrls,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: 'No se pudo generar el PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" /><div className="h-32 bg-muted rounded" /><div className="h-64 bg-muted rounded" />
    </div>
  );

  const templateReadOnly = [
    { label: 'Puesto', value: template?.puesto || '—' },
    { label: 'Período de Entrenamiento', value: template?.periodo_entrenamiento || '—' },
    { label: 'Jefe Directo', value: jefeNombre || '—' },
    {
      label: 'Piloto de Proceso',
      value: template?.es_piloto_proceso
        ? (template.piloto_proceso_codigo ? PILOTO_LABELS[template.piloto_proceso_codigo] ?? template.piloto_proceso_codigo : 'Sí')
        : 'No',
    },
    { label: 'Integrante de Brigada', value: template?.es_integrante_brigada ? 'Sí' : 'No' },
  ];

  const sigTypes = ['empleado', 'jefe_directo', 'recursos_humanos'] as const;
  const sigLabels: Record<string, string> = { empleado: 'Empleado', jefe_directo: 'Jefe Directo', recursos_humanos: 'Recursos Humanos' };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {avgEfectividad != null && (
            <span className="text-sm font-semibold text-foreground border border-border rounded-md px-3 py-1.5">
              Efectividad Promedio: <span className="text-[#2166be]">{avgEfectividad}%</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleExportPdf} disabled={isExporting} className="gap-2">
            <FileDown className="w-4 h-4" />
            {isExporting ? 'Generando...' : 'Exportar PDF'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-foreground mb-3 pb-2 border-b border-border">
          Datos de la Plantilla <span className="text-xs font-normal text-muted-foreground">(solo lectura)</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {templateReadOnly.map(item => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
              <p className="text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">Datos del Empleado</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Empleado</Label>
            <OjtEmployeeSelect
              value={employeeLabel}
              placeholder="Buscar empleado..."
              employees={employees}
              onSelect={emp => {
                if (emp) { setEmployeeId(emp.id); setEmployeeLabel(emp.nombre); if (!nombre) setNombre(emp.nombre); }
                else { setEmployeeId(null); setEmployeeLabel(''); }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha Inicio</Label>
            <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha Término</Label>
            <Input type="date" value={fechaTermino} onChange={e => setFechaTermino(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">Tabla de Evaluación</h2>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full border-collapse text-xs" style={{ minWidth: '1700px' }}>
            <thead>
              <tr className="bg-muted">
                {[
                  'Conocimiento Requerido', 'Habilidades', 'Fuentes de Información', 'Procedimientos Internos',
                  'Método de Entrenamiento', 'Duración', 'F. Planeada Terminación',
                  'F. Real Inicio', 'F. Real Término', 'Efectividad %', 'Firma Empleado', 'Puesto Responsable', 'Responsable', 'Comentarios',
                ].map((h, i) => (
                  <th key={i} className="border border-border px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap"
                    style={{ minWidth: i < 6 || i === 11 ? '140px' : i === 10 || i === 12 ? '150px' : '120px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, gIdx) => (
                <React.Fragment key={group.section_id}>
                  <tr className="bg-[#192b52]/5">
                    <td colSpan={14} className="border border-border px-3 py-1.5">
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                        {group.section_nombre}
                      </span>
                    </td>
                  </tr>
                  {group.rows.map((row, rIdx) => (
                    <tr key={row.entry_id} className="hover:bg-muted/30">
                      {[
                        row.conocimiento_requerido, row.habilidades, row.fuentes_informacion,
                        row.procedimientos_internos, row.metodo_entrenamiento, row.duracion,
                      ].map((val, ci) => {
                        const rawVal = val || '';

                        if (ci === 2 && rawVal) {
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const parts = rawVal.split(urlRegex);
                          return (
                            <td key={ci} className="border border-border px-2 py-1 text-muted-foreground bg-muted/20 align-top">
                              <div className="whitespace-pre-wrap break-words text-xs">
                                {parts.map((part, pIdx) => {
                                  if (part.match(urlRegex)) {
                                    return (
                                      <a
                                        key={pIdx}
                                        href={part}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-[#2166be] hover:text-[#1a5299] transition-colors font-medium mx-0.5"
                                        title={`Abrir: ${part}`}
                                      >
                                        <span className="underline max-w-[150px] truncate align-bottom inline-block">{part}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    );
                                  }
                                  return <span key={pIdx}>{part}</span>;
                                })}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={ci} className="border border-border px-2 py-1 text-muted-foreground bg-muted/20 align-top whitespace-pre-wrap text-xs">
                            {rawVal || '—'}
                          </td>
                        );
                      })}
                      <td className="border border-border px-1 py-0.5">
                        <input type="date" value={row.fecha_planeada_terminacion || ''}
                          onChange={e => updateRowLocal(gIdx, rIdx, 'fecha_planeada_terminacion', e.target.value)}
                          onBlur={e => saveInstanceEntryField(gIdx, rIdx, 'fecha_planeada_terminacion', e.target.value)}
                          className="w-full h-7 px-1.5 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded"
                        />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <input type="date" value={row.fecha_real_inicio}
                          onChange={e => updateRowLocal(gIdx, rIdx, 'fecha_real_inicio', e.target.value)}
                          onBlur={e => saveInstanceEntryField(gIdx, rIdx, 'fecha_real_inicio', e.target.value)}
                          className="w-full h-7 px-1.5 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded"
                        />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <input type="date" value={row.fecha_real_termino}
                          onChange={e => updateRowLocal(gIdx, rIdx, 'fecha_real_termino', e.target.value)}
                          onBlur={e => saveInstanceEntryField(gIdx, rIdx, 'fecha_real_termino', e.target.value)}
                          className="w-full h-7 px-1.5 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded"
                        />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <input type="number" min="0" max="100" value={row.efectividad}
                          onChange={e => updateRowLocal(gIdx, rIdx, 'efectividad', e.target.value)}
                          onBlur={e => saveInstanceEntryField(gIdx, rIdx, 'efectividad', e.target.value)}
                          placeholder="0-100"
                          className="w-full h-7 px-1.5 text-xs bg-transparent border-none outline-none focus:border focus:border-ring rounded"
                          style={{ minWidth: '70px' }}
                        />
                      </td>
                      <td className="border border-border px-1 py-0.5" style={{ minWidth: '150px' }}>
                        <div className="space-y-1">
                          <OjtSignatureCanvas
                            currentUrl={row.empleado_firma_url}
                            instanceId={instanceId}
                            fieldKey={`empleado_entry_${row.entry_id}`}
                            onSave={url => updateRowEmpleadoFirmaUrl(gIdx, rIdx, url)}
                          />
                          <p className="text-[10px] text-center text-muted-foreground">Firma Empleado</p>
                        </div>
                      </td>
                      <td className="border border-border px-2 py-1 text-muted-foreground bg-muted/20">
                        {row.puesto_responsable || '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5" style={{ minWidth: '150px' }}>
                        <div className="space-y-1">
                          <OjtSignatureCanvas
                            currentUrl={row.responsable_firma_url}
                            instanceId={instanceId}
                            fieldKey={`entry_${row.entry_id}`}
                            onSave={url => updateRowFirmaUrl(gIdx, rIdx, url)}
                          />
                          <input
                            type="text"
                            value={row.responsable_nombre}
                            placeholder="Nombre..."
                            onChange={e => updateRowLocal(gIdx, rIdx, 'responsable_nombre', e.target.value)}
                            onBlur={e => saveInstanceEntryField(gIdx, rIdx, 'responsable_nombre', e.target.value)}
                            className="w-full h-6 px-1.5 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded border border-border"
                          />
                        </div>
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <textarea
                          value={row.comentarios}
                          onChange={e => {
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                            updateRowLocal(gIdx, rIdx, 'comentarios', e.target.value);
                          }}
                          onFocus={e => {
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onBlur={e => {
                            e.target.style.height = '28px';
                            saveInstanceEntryField(gIdx, rIdx, 'comentarios', e.target.value);
                          }}
                          placeholder="Comentarios..."
                          className="w-full min-h-[28px] px-1.5 py-1 text-xs bg-transparent border-none outline-none focus:bg-background focus:border focus:border-ring rounded resize-none overflow-hidden"
                          style={{ height: '28px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">Firmas de Liberación</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {sigTypes.map(type => (
            <div key={type} className="space-y-3 border border-border rounded-md p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sigLabels[type]}</p>
              <OjtSignatureCanvas
                currentUrl={sigUrls[type] || null}
                instanceId={instanceId}
                fieldKey={type}
                onSave={url => updateSigFirmaUrl(type, url)}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input
                  value={sigNames[type]}
                  onChange={e => setSigNames(prev => ({ ...prev, [type]: e.target.value }))}
                  onBlur={() => saveSignature(type)}
                  placeholder="Nombre completo"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fecha de Firma</Label>
                <Input
                  type="date"
                  value={sigDates[type]}
                  onChange={e => setSigDates(prev => ({ ...prev, [type]: e.target.value }))}
                  onBlur={() => saveSignature(type)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

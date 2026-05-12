"use client";

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { generateDncPdf } from '@/lib/dnc-pdf';

type DncRow = {
  curso: string;
  inst_interno: string | null;
  inst_externo: string | null;
  proveedor_sugerido: string | null;
  costo: number | null;
  desarrollo_personal: boolean;
  habilidades_blandas: boolean;
  prevencion_riesgos: boolean;
  habilidades_tecnicas: boolean;
  fecha_programada: string | null;
  fecha_real: string | null;
  duration_hours: number | null;
};

type DeteccionRow = {
  id: string;
  nombre: string;
  status: string | null;
  fecha_programada: string | null;
  fecha_real: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  tomado: { label: 'Tomado', bg: 'bg-green-100 text-green-800' },
  no_tomado: { label: 'No tomado', bg: 'bg-red-100 text-red-800' },
  reprogramado: { label: 'Reprogramado', bg: 'bg-yellow-100 text-yellow-800' },
  actualizacion: { label: 'Actualización', bg: 'bg-blue-100 text-blue-800' },
};

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
};

const fmtBool = (v: boolean) => (v ? '✓' : '—');

export default function EmployeeDncPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const employeeId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();

  const [nombre, setNombre] = useState('');
  const [puesto, setPuesto] = useState('');
  const [rows, setRows] = useState<DncRow[]>([]);
  const [detecciones, setDetecciones] = useState<DeteccionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchDnc();
    fetchDetecciones();
  }, [employeeId]);

  const fetchDetecciones = async () => {
    const { data } = await supabase
      .from('deteccion_empleados')
      .select('detecciones!deteccion_id(id, nombre, status, fecha_programada, fecha_real)')
      .eq('employee_id', employeeId);

    if (data) {
      const mapped = (data as any[])
        .map(r => r.detecciones)
        .filter(Boolean) as DeteccionRow[];
      mapped.sort((a, b) => {
        if (!a.fecha_programada && !b.fecha_programada) return a.nombre.localeCompare(b.nombre);
        if (!a.fecha_programada) return 1;
        if (!b.fecha_programada) return -1;
        return b.fecha_programada.localeCompare(a.fecha_programada);
      });
      setDetecciones(mapped);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await generateDncPdf({
        employee: { nombre, puesto },
        courses: rows.map((r) => ({
          name: r.curso,
          inst_interno: r.inst_interno,
          inst_externo: r.inst_externo,
          proveedor_sugerido: r.proveedor_sugerido,
          costo: r.costo,
          desarrollo_personal: r.desarrollo_personal,
          habilidades_blandas: r.habilidades_blandas,
          prevencion_riesgos: r.prevencion_riesgos,
          habilidades_tecnicas: r.habilidades_tecnicas,
          fecha_programada: r.fecha_programada,
          fecha_real: r.fecha_real,
          duration_hours: r.duration_hours,
        })),
      });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo generar el PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const fetchDnc = async () => {
    try {
      const [empResult, courseResult] = await Promise.all([
        supabase
          .from('employees')
          .select('nombre, puesto')
          .eq('id', employeeId)
          .maybeSingle(),
        supabase
          .from('course_participants')
          .select(`
            course:courses!course_id(
              name, inst_interno, inst_externo, proveedor_sugerido, costo,
              desarrollo_personal, habilidades_blandas, prevencion_riesgos,
              habilidades_tecnicas, fecha_programada, fecha_real, duration_hours
            )
          `)
          .eq('employee_id', employeeId),
      ]);

      if (empResult.error) throw empResult.error;
      if (!empResult.data) { router.push('/employees'); return; }

      setNombre(empResult.data.nombre);
      setPuesto(empResult.data.puesto);

      if (courseResult.error) throw courseResult.error;

      const result: DncRow[] = (courseResult.data || [])
        .filter((row: any) => row.course)
        .map((row: any) => ({
          curso: row.course.name || '—',
          inst_interno: row.course.inst_interno ?? null,
          inst_externo: row.course.inst_externo ?? null,
          proveedor_sugerido: row.course.proveedor_sugerido ?? null,
          costo: row.course.costo ?? null,
          desarrollo_personal: row.course.desarrollo_personal ?? false,
          habilidades_blandas: row.course.habilidades_blandas ?? false,
          prevencion_riesgos: row.course.prevencion_riesgos ?? false,
          habilidades_tecnicas: row.course.habilidades_tecnicas ?? false,
          fecha_programada: row.course.fecha_programada ?? null,
          fecha_real: row.course.fecha_real ?? null,
          duration_hours: row.course.duration_hours ?? null,
        }))
        .sort((a: DncRow, b: DncRow) => {
          if (!a.fecha_programada && !b.fecha_programada) return 0;
          if (!a.fecha_programada) return 1;
          if (!b.fecha_programada) return -1;
          return a.fecha_programada.localeCompare(b.fecha_programada);
        });

      setRows(result);
    } catch (error) {
      console.error('Error fetching DNC:', error);
      toast({ title: 'Error', description: 'No se pudo cargar el DNC', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 pt-16 lg:pt-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push(`/employees/${employeeId}`)}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al empleado
        </Button>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">{nombre}</CardTitle>
                <CardDescription className="mt-1">{puesto}</CardDescription>
              </div>
              <Button
                onClick={handleExportPdf}
                disabled={isExporting || rows.length === 0}
                variant="outline"
                className="flex items-center gap-2 flex-shrink-0"
              >
                <FileText className="w-4 h-4" />
                {isExporting ? 'Generando...' : 'Exportar PDF'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground italic text-sm">
                No hay registros DNC para este empleado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Curso</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Inst. Interno</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Inst. Externo</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Proveedor Sugerido</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Costo</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Des. Personal</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Hab. Blandas</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Prev. Riesgos</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Hab. Técnicas</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Fecha Programada</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Fecha Real</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Duración Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-medium">{row.curso}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.inst_interno || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.inst_externo || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.proveedor_sugerido || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          {row.costo != null ? row.costo.toLocaleString('es-MX') : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">{fmtBool(row.desarrollo_personal)}</td>
                        <td className="py-2 px-3 text-center">{fmtBool(row.habilidades_blandas)}</td>
                        <td className="py-2 px-3 text-center">{fmtBool(row.prevencion_riesgos)}</td>
                        <td className="py-2 px-3 text-center">{fmtBool(row.habilidades_tecnicas)}</td>
                        <td className="py-2 px-3">{fmtDate(row.fecha_programada)}</td>
                        <td className="py-2 px-3">{fmtDate(row.fecha_real)}</td>
                        <td className="py-2 px-3 text-right">
                          {row.duration_hours != null ? row.duration_hours : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg mt-6">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-semibold text-[#192b52]">Detecciones</CardTitle>
            <CardDescription className="text-sm">
              Detecciones de necesidad de capacitación asignadas a este empleado
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {detecciones.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">
                Sin detecciones asignadas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Nombre</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Fecha Programada</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Fecha Real</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-[#192b52]">Ver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detecciones.map((d, i) => {
                      const cfg = d.status ? STATUS_CONFIG[d.status] : null;
                      return (
                        <tr
                          key={d.id}
                          className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}
                        >
                          <td className="py-3 px-4 text-sm font-medium">{d.nombre}</td>
                          <td className="py-3 px-4">
                            {cfg ? (
                              <Badge className={cfg.bg}>{cfg.label}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{fmtDate(d.fecha_programada)}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{fmtDate(d.fecha_real)}</td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#2166be] hover:text-[#1a5299] hover:bg-blue-50"
                              onClick={() => router.push(`/detecciones/${d.id}`)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />Ver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

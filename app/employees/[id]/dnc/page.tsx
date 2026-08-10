"use client";

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { generateDncPdf, type DncPdfData } from '@/lib/dnc-pdf';
import { fmtDate } from '@/lib/detecciones-utils';

type UnifiedRow = {
  tipo: 'curso' | 'deteccion';
  nombre: string;
  color: string;
  inst_interno: boolean;
  inst_externo: boolean;
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

const fmtBool = (v: boolean) => (v ? '✓' : '—');

export default function EmployeeDncPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const employeeId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();

  const [nombre, setNombre] = useState('');
  const [puesto, setPuesto] = useState('');
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [employeeId]);

  const fetchAll = async () => {
    try {
      const res = await fetch(`/employees/${employeeId}/dnc/data`);
      if (res.status === 404) {
        router.push('/employees');
        return;
      }
      if (!res.ok) throw new Error('No se pudo cargar el DNC');
      const data = await res.json();

      setNombre(data.nombre || '');
      setPuesto(data.puesto || '');
      setRows(data.rows || []);
    } catch (error) {
      console.error('Error fetching DNC:', error);
      toast({ title: 'Error', description: 'No se pudo cargar el DNC', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfData: DncPdfData = {
        employee: { nombre, puesto },
        items: rows.map(r => ({
          tipo: r.tipo,
          nombre: r.nombre,
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
      };
      await generateDncPdf(pdfData);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo generar el PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
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
          onClick={() => router.push('/employees')}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a empleados
        </Button>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">{nombre}</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">{puesto}</p>
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
            <p className="text-sm font-semibold text-[#192b52] mt-4">Cursos y Detecciones</p>
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
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Inst. Interno</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Inst. Externo</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">Proveedor Sugerido</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Costo</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Des. Personal</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Hab. Blandas</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Prev. Riesgos</th>
                      <th className="text-center py-2 px-3 font-medium whitespace-nowrap">Hab. Técnicas</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">F. Programada</th>
                      <th className="text-left py-2 px-3 font-medium whitespace-nowrap">F. Real</th>
                      <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Duración (hrs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-medium">{row.nombre}</td>
                        <td className="py-2 px-3 text-center">{fmtBool(row.inst_interno)}</td>
                        <td className="py-2 px-3 text-center">{fmtBool(row.inst_externo)}</td>
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
      </div>
    </div>
  );
}

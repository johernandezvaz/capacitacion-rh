"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, ChevronRight, FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { generatePromediosMensualesPdf } from '@/lib/promedios-mensuales-pdf';

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

function buildYearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2];
}

type EvaluacionTipo = 'hot' | 'cold';

interface DetalleRow {
  employee_id: string;
  employee_name: string;
  course_id: string;
  course_name: string;
  promedio_curso: number;
}

interface PromedioPlanta {
  promedio_planta: number;
  num_evaluaciones: number;
  num_empleados: number;
}

function semaforoColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 80) return '#FFB433';
  return '#ef4444';
}

function fmtPct(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

interface FilterSelectProps {
  id: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  label: string;
}

function FilterSelect({ id, value, onChange, options, label }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be] w-fit"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <Skeleton className="h-11 w-full rounded-none" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t border-gray-100" />
        ))}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  promedioPlanta: PromedioPlanta | null;
  tipo: EvaluacionTipo;
}

function SummaryCard({ promedioPlanta, tipo }: SummaryCardProps) {
  const label = tipo === 'hot' ? 'Evaluación Caliente' : 'Evaluación Frío';

  if (!promedioPlanta || promedioPlanta.num_evaluaciones === 0) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="py-6 flex items-center gap-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 flex-shrink-0">
            <TrendingUp className="w-7 h-7 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label} — Promedio Planta</p>
            <p className="text-lg font-semibold text-gray-400 mt-0.5">Sin datos para este mes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const color = semaforoColor(promedioPlanta.promedio_planta);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="py-6 flex items-center gap-5">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full flex-shrink-0"
          style={{ background: `${color}22` }}
        >
          <TrendingUp className="w-7 h-7" style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label} — Promedio Planta</p>
          <p
            className="text-3xl font-bold mt-0.5 tabular-nums"
            style={{ color }}
          >
            {fmtPct(promedioPlanta.promedio_planta)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {promedioPlanta.num_evaluaciones}{' '}
            {promedioPlanta.num_evaluaciones === 1 ? 'evaluación' : 'evaluaciones'} de{' '}
            {promedioPlanta.num_empleados}{' '}
            {promedioPlanta.num_empleados === 1 ? 'empleado' : 'empleados'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface DetalleTableProps {
  rows: DetalleRow[];
}

function DetalleTable({ rows }: DetalleTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 shadow-sm py-16 text-center text-muted-foreground text-sm bg-white">
        No hay evaluaciones completadas para el mes seleccionado
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#192b52' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white">Empleado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white">Curso</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-white">Promedio (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const color = semaforoColor(row.promedio_curso);
              const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
              return (
                <tr
                  key={`${row.employee_id}-${row.course_id}`}
                  style={{ background: rowBg }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                  className="transition-colors"
                >
                  <td className="px-4 py-3 border-b border-gray-100 font-medium text-[#192b52]">
                    {row.employee_name}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-muted-foreground">
                    {row.course_name}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-center tabular-nums">
                    <span className="font-semibold" style={{ color }}>
                      {fmtPct(row.promedio_curso)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TabPanelProps {
  plantId: string;
  tipo: EvaluacionTipo;
  tabId: string;
}

function TabPanel({ plantId, tipo, tabId }: TabPanelProps) {
  const now = new Date();
  const YEARS = buildYearOptions();

  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const [promedioPlanta, setPromedioPlanta] = useState<PromedioPlanta | null>(null);
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/reportes/promedios-mensuales/data?plant_id=${plantId}&year=${year}&month=${month}&type=${tipo}`
      );
      if (!res.ok) throw new Error('Error al cargar datos');
      const data = await res.json();
      setDetalle(data.detalle || []);
      setPromedioPlanta(data.promedioPlanta || null);
    } catch (err) {
      console.error('Error fetching promedio mensual:', err);
    } finally {
      setIsLoading(false);
    }
  }, [plantId, year, month, tipo]);

  useEffect(() => {
    if (plantId) fetchData();
  }, [fetchData, plantId]);

  const mesLabel = MESES.find(m => m.value === month)?.label ?? '';

  const noData = !promedioPlanta || promedioPlanta.num_evaluaciones === 0;

  const handleExportPdf = async () => {
    setIsPdfLoading(true);
    try {
      await generatePromediosMensualesPdf({
        tipo,
        year,
        month,
        promedioPlanta: promedioPlanta?.promedio_planta ?? null,
        numEvaluaciones: promedioPlanta?.num_evaluaciones ?? 0,
        numEmpleados: promedioPlanta?.num_empleados ?? 0,
        detalle: detalle.map(d => ({
          employee_name: d.employee_name,
          course_name: d.course_name,
          promedio_curso: d.promedio_curso,
        })),
      });
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
        <FilterSelect
          id={`${tabId}-year`}
          label="Año"
          value={year}
          onChange={setYear}
          options={YEARS.map(y => ({ value: y, label: String(y) }))}
        />
        <FilterSelect
          id={`${tabId}-month`}
          label="Mes"
          value={month}
          onChange={setMonth}
          options={MESES}
        />
        <p className="text-xs text-muted-foreground self-end pb-2 ml-1">
          {mesLabel} {year}
        </p>
        <div className="ml-auto self-end">
          <button
            onClick={handleExportPdf}
            disabled={isLoading || noData || isPdfLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-[#192b52]"
          >
            <FileDown className="w-4 h-4" />
            {isPdfLoading ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <TabSkeleton />
      ) : (
        <>
          <SummaryCard promedioPlanta={promedioPlanta} tipo={tipo} />
          <DetalleTable rows={detalle} />
        </>
      )}
    </div>
  );
}

export default function PromediosMensualesPage() {
  const { plantId } = useAuth();

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">

          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link href="/" className="hover:text-[#2166be] transition-colors">Inicio</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#192b52] font-medium">Promedios Mensuales</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-[#2166be]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">
                Promedios Mensuales de Capacitación
              </h1>
              <p className="text-muted-foreground text-sm">
                Promedio de calificaciones por empleado, separado por tipo de evaluación
              </p>
            </div>
          </div>
        </div>

        {!plantId ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <Tabs defaultValue="hot" className="space-y-5">
            <TabsList className="bg-white border border-gray-200 shadow-sm h-auto p-1 gap-1">
              <TabsTrigger
                value="hot"
                className="px-5 py-2.5 text-sm font-medium data-[state=active]:bg-[#2166be] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all"
              >
                Evaluación Caliente
              </TabsTrigger>
              <TabsTrigger
                value="cold"
                className="px-5 py-2.5 text-sm font-medium data-[state=active]:bg-[#2166be] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all"
              >
                Evaluación Frío
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hot">
              <TabPanel plantId={plantId} tipo="hot" tabId="hot" />
            </TabsContent>

            <TabsContent value="cold">
              <TabPanel plantId={plantId} tipo="cold" tabId="cold" />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

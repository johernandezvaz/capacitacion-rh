"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OjtListItem = {
  id: string;
  titulo: string | null;
  puesto: string | null;
  periodo_entrenamiento: string | null;
  created_at: string;
};

export default function OjtPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<OjtListItem[]>([]);
  const [puestos, setPuestos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('ojt_records')
        .select('id, titulo, puesto, periodo_entrenamiento, created_at')
        .order('puesto', { ascending: true })
        .order('titulo', { ascending: true });

      if (error) throw error;

      const mapped: OjtListItem[] = (data || []).map((r: any) => ({
        id: r.id,
        titulo: r.titulo,
        puesto: r.puesto,
        periodo_entrenamiento: r.periodo_entrenamiento,
        created_at: r.created_at,
      }));

      setRecords(mapped);

      // 2. Fetch distinct puestos for dropdown
      const { data: puestosData, error: puestosError } = await supabase
        .from('ojt_records')
        .select('puesto')
        .not('puesto', 'is', null)
        .neq('puesto', '');

      if (puestosError) throw puestosError;

      // Extract unique puestos and sort
      const uniquePuestos = Array.from(new Set(puestosData?.map((p: any) => p.puesto) || [])).sort() as string[];
      setPuestos(uniquePuestos);

    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar los registros OJT', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch = !searchQuery.trim() ||
        (r.titulo && r.titulo.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchPuesto = selectedPuesto === 'all' || r.puesto === selectedPuesto;

      return matchSearch && matchPuesto;
    });
  }, [records, searchQuery, selectedPuesto]);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Entrenamiento
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Registro de Entrenamiento en el Puesto
            </p>
          </div>
          <Link href="/ojt/new">
            <Button className="bg-[#2166be] hover:bg-[#1a5299] text-white w-full sm:w-auto" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Registro
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre del entrenamiento..."
              className="pl-9 h-10 w-full"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedPuesto} onValueChange={setSelectedPuesto}>
              <SelectTrigger className="h-10 w-full bg-background border border-input text-sm">
                <SelectValue placeholder="Seleccionar puesto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los puestos</SelectItem>
                {puestos.map((puesto) => (
                  <SelectItem key={puesto} value={puesto}>{puesto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-card rounded-lg animate-pulse border border-border" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No hay registros de Entrenamiento
            </h3>
            <p className="text-muted-foreground mb-6">
              Crea el primer registro de entrenamiento en el puesto
            </p>
            <Link href="/ojt/new">
              <Button className="bg-[#2166be] hover:bg-[#1a5299] text-white">
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Registro
              </Button>
            </Link>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No se encontraron registros que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRecords.map((r) => (
              <Card
                key={r.id}
                className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:shadow-md transition-shadow group border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#2166be] bg-[#2166be]/10 px-2 py-1 rounded-sm">
                      {r.puesto || 'Sin puesto'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground truncate mb-1.5">
                    {r.titulo || 'Sin nombre'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-2">
                    <span className="font-medium text-foreground/70">Período:</span>
                    {r.periodo_entrenamiento || '—'}
                  </p>
                </div>
                <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                  <Link href={`/ojt/${r.id}`} className="w-full sm:w-auto block">
                    <Button variant="outline" className="w-full sm:w-auto gap-2 text-muted-foreground group-hover:text-foreground transition-colors group-hover:border-[#2166be] group-hover:bg-[#2166be]/5">
                      Abrir Registro
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

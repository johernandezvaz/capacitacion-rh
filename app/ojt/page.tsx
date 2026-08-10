"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Users, ChevronRight, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/contexts/auth-context';

type OjtListItem = {
  id: string;
  titulo: string | null;
  puesto: string | null;
  periodo_entrenamiento: string | null;
  created_at: string;
  total_instancias: number;
};

export default function OjtPage() {
  const { toast } = useToast();
  const { plantId } = useAuth();
  const [records, setRecords] = useState<OjtListItem[]>([]);
  const [puestos, setPuestos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');

  const fetchData = async () => {
    if (!plantId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/ojt/data?plant_id=${plantId}`);
      if (!res.ok) throw new Error('Error al cargar las plantillas');
      const data = await res.json();
      setRecords(data.records || []);
      setPuestos(data.puestos || []);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar las plantillas OJT', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [plantId]);

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
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1">
              Entrenamiento en el Puesto
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Registro de Entrenamiento en el Puesto (OJT) — Plantillas
            </p>
          </div>
          <Link href="/ojt/new">
            <Button className="bg-[#2166be] hover:bg-[#1a5299] text-white w-full sm:w-auto" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Nueva Plantilla
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre de entrenamiento..."
              className="pl-9 h-10 w-full"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedPuesto} onValueChange={setSelectedPuesto}>
              <SelectTrigger className="h-10 w-full bg-background border border-input text-sm">
                <SelectValue placeholder="Todos los puestos" />
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
              No hay plantillas de Entrenamiento
            </h3>
            <p className="text-muted-foreground mb-6">
              Crea la primera plantilla de entrenamiento en el puesto
            </p>
            <Link href="/ojt/new">
              <Button className="bg-[#2166be] hover:bg-[#1a5299] text-white">
                <Plus className="w-5 h-5 mr-2" />
                Nueva Plantilla
              </Button>
            </Link>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No se encontraron plantillas con los filtros actuales.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRecords.map((r) => (
              <Card
                key={r.id}
                className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#2166be] bg-[#2166be]/10 px-2 py-0.5 rounded-sm">
                      {r.puesto || 'Sin puesto'}
                    </span>
                    <span className="text-xs text-muted-foreground border border-border rounded-sm px-2 py-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {r.total_instancias} {r.total_instancias === 1 ? 'instancia' : 'instancias'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground truncate mb-0.5">
                    {r.titulo || 'Sin nombre'}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-medium text-foreground/60">Período:</span>
                    {r.periodo_entrenamiento || '—'}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Link href={`/ojt/${r.id}`} className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto gap-2 text-muted-foreground hover:text-foreground hover:border-border"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar plantilla
                    </Button>
                  </Link>
                  <Link href={`/ojt/${r.id}/instancias`} className="w-full sm:w-auto">
                    <Button
                      size="sm"
                      className="w-full sm:w-auto gap-2 bg-[#2166be] hover:bg-[#1a5299] text-white"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Ver instancias
                      <ChevronRight className="w-3.5 h-3.5" />
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

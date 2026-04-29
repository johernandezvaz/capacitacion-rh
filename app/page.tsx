"use client";

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { YearCard } from '@/components/year-card';
import { CreateYearModal } from '@/components/create-year-modal';
import { supabase, TrainingYear } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

export default function HomePage() {
  const { plantId } = useAuth();
  const [years, setYears] = useState<TrainingYear[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchYears = async () => {
    try {
      const { data, error } = await supabase
        .from('training_years')
        .select('*')
        .eq('plant_id', plantId)
        .order('year', { ascending: false });

      if (error) throw error;
      setYears(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los años',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!plantId) return;
    fetchYears();
  }, [plantId]);

  const handleYearCreated = () => {
    fetchYears();
    setIsCreateModalOpen(false);
    toast({
      title: 'Éxito',
      description: 'Año creado correctamente',
    });
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Capacitaciones
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
              Gestión de años y cursos
            </p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#2166be] hover:bg-[#1a5299] text-white w-full sm:w-auto"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Crear Año
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 bg-card rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : years.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No hay años creados
            </h3>
            <p className="text-muted-foreground mb-6">
              Comienza creando tu primer año de capacitación
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#2166be] hover:bg-[#1a5299] text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Año
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {years.map((year) => (
              <YearCard key={year.id} year={year} />
            ))}
          </div>
        )}
      </div>

      <CreateYearModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleYearCreated}
        plantId={plantId || ''}
      />
    </div>
  );
}

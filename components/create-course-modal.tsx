"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface CreateCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  yearId: string;
}

export function CreateCourseModal({
  open,
  onOpenChange,
  onSuccess,
  yearId,
}: CreateCourseModalProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !date || !duration) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    const durationNumber = parseInt(duration);
    if (durationNumber <= 0) {
      toast({
        title: 'Error',
        description: 'La duración debe ser mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      toast({
        title: 'Error',
        description: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error: insertError } = await supabase.from('courses').insert([
        {
          year_id: yearId,
          name: name.trim(),
          date,
          start_date: startDate || null,
          end_date: endDate || null,
          duration_hours: durationNumber,
          status: 'draft',
        },
      ]);

      if (insertError) throw insertError;

      setName('');
      setDate('');
      setStartDate('');
      setEndDate('');
      setDuration('');
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear el curso',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDate('');
    setStartDate('');
    setEndDate('');
    setDuration('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Crear Curso</DialogTitle>
          <DialogDescription>
            Ingresa los detalles del nuevo curso de capacitación
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Curso</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ej: Seguridad en el Trabajo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Fecha de Inicio (Opcional)</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">Fecha de Fin (Opcional)</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (horas)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="8"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#2166be] hover:bg-[#1a5299] text-white"
            >
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

export interface CreateCourseModalPrefill {
  name?: string;
  instInterno?: string;
  proveedorSugerido?: string;
  costo?: string;
  fechaProgramada?: string;
  fechaReal?: string;
  durationHours?: string;
  desarrolloPersonal?: boolean;
  habilidadesBlandas?: boolean;
  prevencionRiesgos?: boolean;
  habilidadesTecnicas?: boolean;
  comentarioDnc?: string;
}

interface CreateCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  yearId: string;
  plantId: string;
  prefill?: CreateCourseModalPrefill;
}

export function CreateCourseModal({
  open,
  onOpenChange,
  onSuccess,
  yearId,
  plantId,
  prefill,
}: CreateCourseModalProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // DNC fields
  const [isDncOpen, setIsDncOpen] = useState(false);
  const [instInterno, setInstInterno] = useState('');
  const [proveedorSugerido, setProveedorSugerido] = useState('');
  const [costo, setCosto] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [fechaReal, setFechaReal] = useState('');
  const [desarrolloPersonal, setDesarrolloPersonal] = useState(false);
  const [habilidadesBlandas, setHabilidadesBlandas] = useState(false);
  const [prevencionRiesgos, setPrevencionRiesgos] = useState(false);
  const [habilidadesTecnicas, setHabilidadesTecnicas] = useState(false);
  const [comentarioDnc, setComentarioDnc] = useState('');

  const { toast } = useToast();

  // Apply prefill whenever the modal opens with a prefill object
  useEffect(() => {
    if (open && prefill) {
      setName(prefill.name ?? '');
      setInstInterno(prefill.instInterno ?? '');
      setProveedorSugerido(prefill.proveedorSugerido ?? '');
      setCosto(prefill.costo ?? '');
      setFechaProgramada(prefill.fechaProgramada ?? '');
      setFechaReal(prefill.fechaReal ?? '');
      setDuration(prefill.durationHours ?? '');
      setDesarrolloPersonal(prefill.desarrolloPersonal ?? false);
      setHabilidadesBlandas(prefill.habilidadesBlandas ?? false);
      setPrevencionRiesgos(prefill.prevencionRiesgos ?? false);
      setHabilidadesTecnicas(prefill.habilidadesTecnicas ?? false);
      setComentarioDnc(prefill.comentarioDnc ?? '');
      setIsDncOpen(true); // expand DNC section when prefilling from detección
    }
  }, [open, prefill]);

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setDuration('');
    setIsDncOpen(false);
    setInstInterno('');
    setProveedorSugerido('');
    setCosto('');
    setFechaProgramada('');
    setFechaReal('');
    setDesarrolloPersonal(false);
    setHabilidadesBlandas(false);
    setPrevencionRiesgos(false);
    setHabilidadesTecnicas(false);
    setComentarioDnc('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !duration) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    const durationNumber = parseFloat(duration);
    if (isNaN(durationNumber) || durationNumber <= 0) {
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
      const dateValue = startDate || new Date().toISOString().split('T')[0];

      const { error: insertError } = await supabase.from('courses').insert([
        {
          year_id: yearId,
          name: name.trim(),
          date: dateValue,
          start_date: startDate || null,
          end_date: endDate || null,
          duration_hours: durationNumber,
          status: 'active',
          plant_id: plantId || null,
          // DNC fields
          inst_interno: instInterno.trim() || null,
          proveedor_sugerido: proveedorSugerido.trim() || null,
          costo: costo ? parseFloat(costo) : null,
          fecha_programada: fechaProgramada || null,
          fecha_real: fechaReal || null,
          desarrollo_personal: desarrolloPersonal,
          habilidades_blandas: habilidadesBlandas,
          prevencion_riesgos: prevencionRiesgos,
          habilidades_tecnicas: habilidadesTecnicas,
          comentario_dnc: comentarioDnc.trim() || null,
        },
      ]);

      if (insertError) throw insertError;

      resetForm();
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
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Fecha de Inicio</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">Fecha de Fin</Label>
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
                min="0.1"
                step="any"
                required
              />
            </div>

            {/* DNC collapsible section */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsDncOpen(!isDncOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-muted-foreground"
              >
                <span>Datos DNC (opcional)</span>
                {isDncOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isDncOpen && (
                <div className="p-4 space-y-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inst-interno">Inst. Interno</Label>
                      <Input
                        id="inst-interno"
                        type="text"
                        placeholder="Instructor interno"
                        value={instInterno}
                        onChange={(e) => setInstInterno(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proveedor-sugerido">Proveedor Sugerido</Label>
                      <Input
                        id="proveedor-sugerido"
                        type="text"
                        placeholder="Nombre del proveedor"
                        value={proveedorSugerido}
                        onChange={(e) => setProveedorSugerido(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costo">Costo</Label>
                    <Input
                      id="costo"
                      type="number"
                      placeholder="0.00"
                      value={costo}
                      onChange={(e) => setCosto(e.target.value)}
                      min="0"
                      step="any"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fecha-programada">Fecha Programada</Label>
                      <Input
                        id="fecha-programada"
                        type="date"
                        value={fechaProgramada}
                        onChange={(e) => setFechaProgramada(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fecha-real">Fecha Real</Label>
                      <Input
                        id="fecha-real"
                        type="date"
                        value={fechaReal}
                        onChange={(e) => setFechaReal(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comentario-dnc">Comentario DNC</Label>
                    <textarea
                      id="comentario-dnc"
                      value={comentarioDnc}
                      onChange={e => setComentarioDnc(e.target.value)}
                      placeholder="Observaciones..."
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Tipo de Capacitación</Label>
                    {[
                      { id: 'dnc-desarrollo-personal', label: 'Desarrollo Personal y Académico', value: desarrolloPersonal, setter: setDesarrolloPersonal },
                      { id: 'dnc-habilidades-blandas', label: 'Habilidades Blandas', value: habilidadesBlandas, setter: setHabilidadesBlandas },
                      { id: 'dnc-prevencion-riesgos', label: 'Prevención de Riesgos y Accidentes', value: prevencionRiesgos, setter: setPrevencionRiesgos },
                      { id: 'dnc-habilidades-tecnicas', label: 'Habilidades Técnicas', value: habilidadesTecnicas, setter: setHabilidadesTecnicas },
                    ].map(({ id, label, value, setter }) => (
                      <label key={id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          id={id}
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setter(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#2166be] focus:ring-[#2166be]"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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

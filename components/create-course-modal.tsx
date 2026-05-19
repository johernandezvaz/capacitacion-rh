"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
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

interface DeteccionOption {
  id: string;
  nombre: string;
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

  const [isDncOpen, setIsDncOpen] = useState(false);
  const [instInterno, setInstInterno] = useState('');
  const [instExterno, setInstExterno] = useState('');
  const [proveedorSugerido, setProveedorSugerido] = useState('');
  const [costo, setCosto] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [fechaReal, setFechaReal] = useState('');
  const [desarrolloPersonal, setDesarrolloPersonal] = useState(false);
  const [habilidadesBlandas, setHabilidadesBlandas] = useState(false);
  const [prevencionRiesgos, setPrevencionRiesgos] = useState(false);
  const [habilidadesTecnicas, setHabilidadesTecnicas] = useState(false);
  const [comentarioDnc, setComentarioDnc] = useState('');

  const [detecciones, setDetecciones] = useState<DeteccionOption[]>([]);
  const [selectedDeteccionId, setSelectedDeteccionId] = useState<string | null>(null);
  const [detSearch, setDetSearch] = useState('');
  const [detDropOpen, setDetDropOpen] = useState(false);
  const detDropRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (open && plantId && yearId) {
      loadDetecciones();
    }
  }, [open, plantId, yearId]);

  const loadDetecciones = async () => {
    const { data: linked } = await supabase
      .from('courses')
      .select('deteccion_id')
      .eq('plant_id', plantId)
      .eq('year_id', yearId)
      .not('deteccion_id', 'is', null);

    const linkedIds = (linked || []).map((r: any) => r.deteccion_id).filter(Boolean);

    let query = supabase
      .from('detecciones')
      .select('id, nombre, inst_interno, inst_externo, proveedor_sugerido, costo, desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas, fecha_programada, fecha_real, duration_hours')
      .eq('plant_id', plantId)
      .eq('year_id', yearId)
      .order('nombre', { ascending: true });

    if (linkedIds.length > 0) {
      query = query.not('id', 'in', `(${linkedIds.join(',')})`);
    }

    const { data } = await query;
    setDetecciones((data as DeteccionOption[]) || []);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (detDropRef.current && !detDropRef.current.contains(e.target as Node)) {
        setDetDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      setIsDncOpen(true);
    }
  }, [open, prefill]);

  const applyDeteccion = (det: DeteccionOption) => {
    setSelectedDeteccionId(det.id);
    setDetSearch(det.nombre);
    setDetDropOpen(false);
    setInstInterno(det.inst_interno ?? '');
    setInstExterno(det.inst_externo ?? '');
    setProveedorSugerido(det.proveedor_sugerido ?? '');
    setCosto(det.costo != null ? String(det.costo) : '');
    setDesarrolloPersonal(det.desarrollo_personal);
    setHabilidadesBlandas(det.habilidades_blandas);
    setPrevencionRiesgos(det.prevencion_riesgos);
    setHabilidadesTecnicas(det.habilidades_tecnicas);
    setFechaProgramada(det.fecha_programada ?? '');
    setFechaReal(det.fecha_real ?? '');
    setDuration(det.duration_hours != null ? String(det.duration_hours) : duration);
    setIsDncOpen(true);
  };

  const clearDeteccion = () => {
    setSelectedDeteccionId(null);
    setDetSearch('');
    setInstInterno('');
    setInstExterno('');
    setProveedorSugerido('');
    setCosto('');
    setDesarrolloPersonal(false);
    setHabilidadesBlandas(false);
    setPrevencionRiesgos(false);
    setHabilidadesTecnicas(false);
    setFechaProgramada('');
    setFechaReal('');
  };

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setDuration('');
    setIsDncOpen(false);
    setInstInterno('');
    setInstExterno('');
    setProveedorSugerido('');
    setCosto('');
    setFechaProgramada('');
    setFechaReal('');
    setDesarrolloPersonal(false);
    setHabilidadesBlandas(false);
    setPrevencionRiesgos(false);
    setHabilidadesTecnicas(false);
    setComentarioDnc('');
    setSelectedDeteccionId(null);
    setDetSearch('');
    setDetDropOpen(false);
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

      const { data: insertedCourse, error: insertError } = await supabase.from('courses').insert([
        {
          year_id: yearId,
          name: name.trim(),
          date: dateValue,
          start_date: startDate || null,
          end_date: endDate || null,
          duration_hours: durationNumber,
          status: 'active',
          plant_id: plantId || null,
          inst_interno: instInterno.trim() || null,
          inst_externo: instExterno.trim() || null,
          proveedor_sugerido: proveedorSugerido.trim() || null,
          costo: costo ? parseFloat(costo) : null,
          fecha_programada: fechaProgramada || null,
          fecha_real: fechaReal || null,
          desarrollo_personal: desarrolloPersonal,
          habilidades_blandas: habilidadesBlandas,
          prevencion_riesgos: prevencionRiesgos,
          habilidades_tecnicas: habilidadesTecnicas,
          comentario_dnc: comentarioDnc.trim() || null,
          deteccion_id: selectedDeteccionId || null,
        },
      ]).select('id').single();

      if (insertError) throw insertError;

      if (insertedCourse?.id && !selectedDeteccionId) {
        const { data: det } = await supabase
          .from('detecciones')
          .insert([{
            nombre: name.trim(),
            plant_id: plantId,
            year_id: yearId,
            color: '#ef4444',
            status: 'no_tomado',
            inst_interno: instInterno.trim() || null,
            inst_externo: instExterno.trim() || null,
            proveedor_sugerido: proveedorSugerido.trim() || null,
            costo: costo ? parseFloat(costo) : null,
            desarrollo_personal: desarrolloPersonal,
            habilidades_blandas: habilidadesBlandas,
            prevencion_riesgos: prevencionRiesgos,
            habilidades_tecnicas: habilidadesTecnicas,
            fecha_programada: fechaProgramada || null,
            fecha_real: fechaReal || null,
            duration_hours: durationNumber || null,
          }])
          .select()
          .single();

        if (det?.id) {
          await supabase.from('courses')
            .update({ deteccion_id: det.id })
            .eq('id', insertedCourse.id);
        }
      }

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

  const filteredDetecciones = detecciones.filter(d =>
    !detSearch || d.nombre.toLowerCase().includes(detSearch.toLowerCase())
  );

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

            <div className="space-y-2">
              <Label htmlFor="deteccion-search">Originado de detección <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="relative" ref={detDropRef}>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="deteccion-search"
                      type="text"
                      value={detSearch}
                      onChange={e => { setDetSearch(e.target.value); setDetDropOpen(true); }}
                      onFocus={() => setDetDropOpen(true)}
                      placeholder="Buscar detección..."
                      autoComplete="off"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {selectedDeteccionId && (
                    <button type="button" onClick={clearDeteccion}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Limpiar selección">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {detDropOpen && filteredDetecciones.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                    {filteredDetecciones.map(det => (
                      <button
                        key={det.id}
                        type="button"
                        onClick={() => applyDeteccion(det)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${selectedDeteccionId === det.id ? 'bg-blue-50 font-medium text-[#2166be]' : ''}`}
                      >
                        {det.nombre}
                      </button>
                    ))}
                  </div>
                )}

                {detDropOpen && detSearch && filteredDetecciones.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                    Sin resultados
                  </div>
                )}
              </div>
              {selectedDeteccionId && (
                <p className="text-xs text-[#22c55e] font-medium flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" />
                  Datos DNC auto-rellenados desde la detección seleccionada
                </p>
              )}
            </div>

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
                      <Label htmlFor="inst-externo">Inst. Externo</Label>
                      <Input
                        id="inst-externo"
                        type="text"
                        placeholder="Instructor externo"
                        value={instExterno}
                        onChange={(e) => setInstExterno(e.target.value)}
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

"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, ChevronLeft, ChevronRight, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { OjtEmployeeSelect } from '@/components/ojt-employee-select';
import { supabase, Employee, OjtInstance, OjtRecord } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { fmtDate } from '@/lib/detecciones-utils';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', in_progress: 'En Progreso', completed: 'Completado', locked: 'Bloqueado',
};
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  locked: 'bg-red-100 text-red-800 border-red-200',
};


export default function OjtInstanciasPage() {
  const params = useParams();
  const templateId = params.id as string;
  const { toast } = useToast();
  const { plantId } = useAuth();

  const [template, setTemplate] = useState<OjtRecord | null>(null);
  const [instances, setInstances] = useState<OjtInstance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [newEmployeeId, setNewEmployeeId] = useState<string | null>(null);
  const [newEmployeeLabel, setNewEmployeeLabel] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newFechaInicio, setNewFechaInicio] = useState('');
  const [newFechaTermino, setNewFechaTermino] = useState('');

  const fetchData = async () => {
    try {
      const [{ data: tmpl }, { data: inst }, { data: emps }] = await Promise.all([
        supabase.from('ojt_records').select('*').eq('id', templateId).maybeSingle(),
        supabase
          .from('ojt_instances')
          .select('*, employees(nombre, puesto)')
          .eq('template_id', templateId)
          .order('created_at', { ascending: false }),
        supabase.from('employees').select('id, nombre, puesto, employee_number, area, evaluador, created_at').eq('plant_id', plantId).order('nombre'),
      ]);
      setTemplate(tmpl ?? null);
      setInstances(
        (inst || []).map((i: any) => ({
          ...i,
          empleado_nombre: i.employees?.nombre ?? null,
          empleado_puesto: i.employees?.puesto ?? null,
        }))
      );
      setEmployees(emps || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar los datos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [templateId]);

  const resetModal = () => {
    setNewEmployeeId(null); setNewEmployeeLabel('');
    setNewNombre(''); setNewFechaInicio(''); setNewFechaTermino('');
  };

  const handleCreateInstance = async () => {
    setIsCreating(true);
    try {
      const { data: instance, error: instErr } = await supabase
        .from('ojt_instances')
        .insert([{
          template_id: templateId,
          employee_id: newEmployeeId || null,
          nombre: newNombre || null,
          fecha_inicio: newFechaInicio || null,
          fecha_termino: newFechaTermino || null,
          status: 'draft',
        }])
        .select()
        .single();
      if (instErr) throw instErr;

      const { data: sections } = await supabase
        .from('ojt_sections')
        .select('ojt_entries(id)')
        .eq('record_id', templateId);

      const entryIds: string[] = [];
      (sections || []).forEach((s: any) => {
        (s.ojt_entries || []).forEach((e: any) => entryIds.push(e.id));
      });

      if (entryIds.length > 0) {
        await supabase.from('ojt_instance_entries').insert(
          entryIds.map(entry_id => ({ instance_id: instance.id, entry_id }))
        );
      }

      toast({ title: 'Instancia creada', description: 'Se creó la instancia correctamente' });
      setShowModal(false);
      resetModal();
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo crear la instancia', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!window.confirm("¿Estás seguro? Esta acción no se puede deshacer")) return;
    try {
      const { error } = await supabase.from('ojt_instances').delete().eq('id', instanceId);
      if (error) throw error;
      toast({ title: 'Instancia eliminada', description: 'La instancia se ha eliminado correctamente.' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo eliminar la instancia', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
          <Link href="/ojt" className="hover:text-foreground transition-colors">Entrenamiento</Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <Link href={`/ojt/${templateId}`} className="hover:text-foreground transition-colors">
            {template?.titulo || 'Plantilla'}
          </Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-foreground font-medium">Instancias</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              {template?.titulo || 'Plantilla'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {template?.puesto || ''}{template?.periodo_entrenamiento ? ` · ${template.periodo_entrenamiento}` : ''}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link href={`/ojt/${templateId}`}>
              <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
                <ChevronLeft className="w-4 h-4" />
                Editar plantilla
              </Button>
            </Link>
            <Button
              className="bg-[#2166be] hover:bg-[#1a5299] text-white gap-2"
              onClick={() => { resetModal(); setShowModal(true); }}
            >
              <Plus className="w-4 h-4" />
              Agregar empleado
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-card rounded-lg animate-pulse border border-border" />)}
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Sin instancias</h3>
            <p className="text-muted-foreground mb-6 text-sm">Agrega el primer empleado para crear una instancia de esta plantilla</p>
            <Button className="bg-[#2166be] hover:bg-[#1a5299] text-white" onClick={() => { resetModal(); setShowModal(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Agregar empleado
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map(inst => (
              <Card key={inst.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${STATUS_CLASS[inst.status]}`}>
                      {STATUS_LABEL[inst.status]}
                    </span>
                    {inst.average_efectividad != null && (
                      <span className="text-xs text-muted-foreground border border-border rounded-sm px-2 py-0.5">
                        Efectividad: <strong>{Math.round(inst.average_efectividad)}%</strong>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {inst.nombre || inst.empleado_nombre || 'Sin nombre'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {inst.empleado_puesto || ''}
                    {inst.fecha_inicio ? ` · Inicio: ${fmtDate(inst.fecha_inicio)}` : ''}
                    {inst.fecha_termino ? ` · Término: ${fmtDate(inst.fecha_termino)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 w-full sm:w-auto">
                  <Link href={`/ojt/${templateId}/instancias/${inst.id}`} className="w-full sm:w-auto">
                    <Button size="sm" className="w-full sm:w-auto gap-2 bg-[#2166be] hover:bg-[#1a5299] text-white">
                      Abrir
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full sm:w-auto gap-2"
                    onClick={() => handleDeleteInstance(inst.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Empleado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Empleado</Label>
              <OjtEmployeeSelect
                value={newEmployeeLabel}
                placeholder="Buscar empleado..."
                employees={employees}
                onSelect={emp => {
                  if (emp) { setNewEmployeeId(emp.id); setNewEmployeeLabel(emp.nombre); if (!newNombre) setNewNombre(emp.nombre); }
                  else { setNewEmployeeId(null); setNewEmployeeLabel(''); }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre (en el registro)</Label>
              <Input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre del empleado" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fecha Inicio</Label>
                <Input type="date" value={newFechaInicio} onChange={e => setNewFechaInicio(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fecha Término</Label>
                <Input type="date" value={newFechaTermino} onChange={e => setNewFechaTermino(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isCreating}>Cancelar</Button>
            <Button onClick={handleCreateInstance} disabled={isCreating} className="bg-[#2166be] hover:bg-[#1a5299] text-white">
              {isCreating ? 'Creando...' : 'Crear instancia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

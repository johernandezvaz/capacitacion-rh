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
import { type Employee, type OjtInstance, type OjtRecord } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { fmtDate } from '@/lib/detecciones-utils';
import { ConfirmDialog } from '@/components/confirm-dialog';

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
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    instanceId: string | null;
  }>({ open: false, instanceId: null });

  const [newEmployeeId, setNewEmployeeId] = useState<string | null>(null);
  const [newEmployeeLabel, setNewEmployeeLabel] = useState('');
  const [newJefeId, setNewJefeId] = useState<string | null>(null);
  const [newJefeLabel, setNewJefeLabel] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newFechaInicio, setNewFechaInicio] = useState('');
  const [newFechaTermino, setNewFechaTermino] = useState('');

  const [activeTab, setActiveTab] = useState<'activos' | 'bajas'>('activos');

  const instanciasActivas = instances.filter(i => !i.es_baja);
  const instanciasBajas = instances.filter(i => i.es_baja);

  const fetchData = async () => {
    try {
      const res = await fetch(`/ojt/${templateId}/instancias/data?plant_id=${plantId || ''}`);
      if (!res.ok) throw new Error('No se pudieron cargar los datos');
      const data = await res.json();
      setTemplate(data.template ?? null);
      setInstances(data.instances || []);
      setEmployees(data.employees || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar los datos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [templateId, plantId]);

  const resetModal = () => {
    setNewEmployeeId(null); setNewEmployeeLabel('');
    setNewJefeId(null); setNewJefeLabel('');
    setNewNombre(''); setNewFechaInicio(''); setNewFechaTermino('');
  };

  const handleCreateInstance = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/ojt/${templateId}/instancias/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: newEmployeeId || null,
          jefe_directo_id: newJefeId || null,
          nombre: newNombre || null,
          fecha_inicio: newFechaInicio || null,
          fecha_termino: newFechaTermino || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'No se pudo crear la instancia');
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
    try {
      const res = await fetch(`/ojt/${templateId}/instancias/data?instance_id=${instanceId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'No se pudo eliminar la instancia');
      }
      toast({ title: 'Instancia eliminada', description: 'La instancia se ha eliminado correctamente.' });
      setDeleteDialog({ open: false, instanceId: null });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo eliminar la instancia', variant: 'destructive' });
    }
  };

  const handleToggleBaja = async (instanceId: string, currentValue: boolean) => {
    try {
      const res = await fetch(`/ojt/${templateId}/instancias/data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_baja',
          instance_id: instanceId,
          es_baja: !currentValue,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'No se pudo actualizar');
      }
      setInstances(prev =>
        prev.map(i => i.id === instanceId ? { ...i, es_baja: !currentValue } : i)
      );
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  const renderInstancia = (inst: OjtInstance) => {
    return (
      <Card key={inst.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {inst.status && inst.status !== 'draft' && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${STATUS_CLASS[inst.status] ?? ''}`}>
                {STATUS_LABEL[inst.status] ?? inst.status}
              </span>
            )}
            {inst.average_efectividad != null && (
              <span className="text-xs text-muted-foreground border border-border rounded-sm px-2 py-0.5">
                Efectividad: <strong>{Math.round(inst.average_efectividad)}%</strong>
              </span>
            )}
            {inst.es_baja && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                Baja
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
            variant="outline"
            className="w-full sm:w-auto text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50"
            onClick={() => handleToggleBaja(inst.id, Boolean(inst.es_baja))}
          >
            {inst.es_baja ? 'Reactivar' : 'Marcar baja'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="w-full sm:w-auto gap-2"
            onClick={() => setDeleteDialog({ open: true, instanceId: inst.id })}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </Button>
        </div>
      </Card>
    );
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
            {activeTab === 'activos' && (
              <Button
                className="bg-[#2166be] hover:bg-[#1a5299] text-white gap-2"
                onClick={() => { resetModal(); setShowModal(true); }}
              >
                <Plus className="w-4 h-4" />
                Agregar empleado
              </Button>
            )}
          </div>
        </div>

        {!isLoading && (
          <div className="mb-6">
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setActiveTab('activos')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'activos'
                    ? 'border-[#2166be] text-[#2166be]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Activos ({instanciasActivas.length})
              </button>
              <button
                onClick={() => setActiveTab('bajas')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'bajas'
                    ? 'border-[#2166be] text-[#2166be]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Bajas ({instanciasBajas.length})
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-card rounded-lg animate-pulse border border-border" />)}
          </div>
        ) : activeTab === 'activos' ? (
          instanciasActivas.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No hay instancias activas</h3>
              <p className="text-muted-foreground mb-6 text-sm">Agrega el primer empleado para crear una instancia de esta plantilla</p>
              <Button className="bg-[#2166be] hover:bg-[#1a5299] text-white" onClick={() => { resetModal(); setShowModal(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Agregar empleado
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instanciasActivas.map(renderInstancia)}
            </div>
          )
        ) : (
          instanciasBajas.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No hay empleados marcados como baja</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {instanciasBajas.map(renderInstancia)}
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, instanceId: deleteDialog.instanceId })}
        title="¿Eliminar instancia?"
        description="Esta acción eliminará permanentemente la instancia y todos sus datos de evaluación y firmas. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={() => {
          if (deleteDialog.instanceId)
            handleDeleteInstance(deleteDialog.instanceId);
        }}
        variant="destructive"
      />

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
              <Label className="text-xs text-muted-foreground">Jefe Directo</Label>
              <OjtEmployeeSelect
                value={newJefeLabel}
                placeholder="Buscar jefe directo..."
                employees={employees}
                onSelect={emp => {
                  if (emp) { setNewJefeId(emp.id); setNewJefeLabel(emp.nombre); }
                  else { setNewJefeId(null); setNewJefeLabel(''); }
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

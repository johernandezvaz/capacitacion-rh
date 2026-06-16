"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, ChevronRight, Trash2, Pencil, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CourseCard } from '@/components/course-card';
import { CreateCourseModal, CreateCourseModalPrefill } from '@/components/create-course-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase, TrainingYear, Course } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

export default function YearDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { plantId } = useAuth();
  const [year, setYear] = useState<TrainingYear | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    hasCourses: false,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [deleteCourseDialog, setDeleteCourseDialog] = useState<{ open: boolean; course: Course | null }>({
    open: false,
    course: null,
  });

  const [renameCourseDialog, setRenameCourseDialog] = useState<{ open: boolean; course: Course | null }>({
    open: false,
    course: null,
  });
  const [renameValue, setRenameValue] = useState('');
  const [isRenameSaving, setIsRenameSaving] = useState(false);

  // --- Crear a partir de detección ---
  const [detPickerOpen, setDetPickerOpen] = useState(false);
  const [allDetecciones, setAllDetecciones] = useState<any[]>([]);
  const [detSearch, setDetSearch] = useState('');
  const [createFromDet, setCreateFromDet] = useState<any | null>(null);

  const STATUS_DOTS: Record<string, string> = {
    tomado: 'bg-green-500', no_tomado: 'bg-red-500',
    reprogramado: 'bg-yellow-500', actualizacion: 'bg-blue-500',
  };
  const STATUS_LABELS: Record<string, string> = {
    tomado: 'Tomado', no_tomado: 'No tomado',
    reprogramado: 'Reprogramado', actualizacion: 'Actualización',
  };

  const openDetPicker = async () => {
    const { data } = await supabase.from('detecciones').select('*').order('nombre', { ascending: true });
    setAllDetecciones(data || []);
    setDetSearch('');
    setDetPickerOpen(true);
  };

  const selectDeteccion = (det: any) => {
    setCreateFromDet(det);
    setDetPickerOpen(false);
    setIsCreateModalOpen(true);
  };

  function fmtDate(v: string | null) {
    if (!v) return '—';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  }

  const fetchYearAndCourses = async () => {
    try {
      const { data: yearData, error: yearError } = await supabase
        .from('training_years')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (yearError) throw yearError;
      if (!yearData) {
        router.push('/');
        return;
      }

      setYear(yearData);

      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('year_id', params.id)
        .eq('plant_id', plantId)
        .order('date', { ascending: true });

      if (coursesError) throw coursesError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const modifiedCourses = await Promise.all((coursesData || []).map(async (course: Course) => {
        if (course.status === 'active' && course.end_date) {
            const endDate = new Date(course.end_date + 'T12:00:00');
            endDate.setHours(0, 0, 0, 0);
            if (endDate < today) {
                await supabase.from('courses').update({ status: 'closed' }).eq('id', course.id);
                return { ...course, status: 'closed' as const };
            }
        }
        return course;
      }));

      setCourses(modifiedCourses);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYearAndCourses();
  }, [params.id]);

  const handleCourseCreated = () => {
    fetchYearAndCourses();
    setIsCreateModalOpen(false);
    setCreateFromDet(null);
    toast({
      title: 'Éxito',
      description: 'Curso creado correctamente',
    });
  };

  const handleDeleteClick = () => {
    setDeleteDialog({
      open: true,
      hasCourses: courses.length > 0,
    });
  };

  const handleDeleteYear = async () => {
    try {
      if (courses.length > 0) {
        for (const course of courses) {
          await supabase
            .from('course_participants')
            .delete()
            .eq('course_id', course.id);
        }

        const { error: coursesError } = await supabase
          .from('courses')
          .delete()
          .eq('year_id', params.id);

        if (coursesError) throw coursesError;
      }

      const { error: yearError } = await supabase
        .from('training_years')
        .delete()
        .eq('id', params.id);

      if (yearError) throw yearError;

      toast({
        title: 'Éxito',
        description: 'Año eliminado correctamente',
      });

      router.push('/');
    } catch (error: any) {
      console.error('Error deleting year:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el año',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialog({ open: false, hasCourses: false });
    }
  };

  const handleDeleteCourseClick = (e: React.MouseEvent, course: Course) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteCourseDialog({ open: true, course });
  };

  const handleDeleteCourse = async () => {
    const course = deleteCourseDialog.course;
    if (!course) return;
    try {
      await supabase.from('course_participants').delete().eq('course_id', course.id);
      const { error } = await supabase.from('courses').delete().eq('id', course.id);
      if (error) throw error;
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      toast({ title: 'Éxito', description: `Curso "${course.name}" eliminado correctamente` });
    } catch (error: any) {
      console.error('Error deleting course:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el curso',
        variant: 'destructive',
      });
    } finally {
      setDeleteCourseDialog({ open: false, course: null });
    }
  };

  const handleRenameCourseClick = (e: React.MouseEvent, course: Course) => {
    e.preventDefault();
    e.stopPropagation();
    setRenameValue(course.name);
    setRenameCourseDialog({ open: true, course });
  };

  const handleRenameCourse = async () => {
    const course = renameCourseDialog.course;
    if (!course) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast({ title: 'Error', description: 'El nombre no puede estar vacío', variant: 'destructive' });
      return;
    }
    setIsRenameSaving(true);
    try {
      const { error } = await supabase.from('courses').update({ name: trimmed }).eq('id', course.id);
      if (error) throw error;
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, name: trimmed } : c)));
      toast({ title: 'Éxito', description: 'Nombre del curso actualizado' });
      setRenameCourseDialog({ open: false, course: null });
    } catch (error: any) {
      console.error('Error renaming course:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el nombre',
        variant: 'destructive',
      });
    } finally {
      setIsRenameSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64" />
            <div className="h-12 bg-muted rounded w-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!year) return null;

  const groupedCourses = (() => {
    const groups: Record<string, { label: string; sortKey: string; courses: Course[] }> = {};
    const noDateCourses: Course[] = [];

    const filteredCourses = courses.filter(course =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredCourses.forEach(course => {
      const fechaAgrupacion = course.start_date ?? course.date;
      if (!fechaAgrupacion) {
        noDateCourses.push(course);
      } else {
        const d = new Date(fechaAgrupacion + 'T12:00:00');
        const month = d.toLocaleString('es-ES', { month: 'long' });
        const yearVal = d.getFullYear();
        const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
        const label = `${monthCap} ${yearVal}`;
        const sortKey = `${yearVal}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!groups[sortKey]) {
          groups[sortKey] = { label, sortKey, courses: [] };
        }
        groups[sortKey].courses.push(course);
      }
    });

    const sortedGroups = Object.values(groups).sort((a, b) => {
      return sortOrder === 'desc'
        ? b.sortKey.localeCompare(a.sortKey)
        : a.sortKey.localeCompare(b.sortKey);
    });

    sortedGroups.forEach(group => {
      group.courses.sort((a, b) => {
        const dateA = (a.start_date ?? a.date) || '';
        const dateB = (b.start_date ?? b.date) || '';
        return sortOrder === 'desc'
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB);
      });
    });

    if (noDateCourses.length > 0) {
      sortedGroups.push({ label: 'Sin fecha', sortKey: sortOrder === 'desc' ? '0000-00' : '9999-99', courses: noDateCourses });
    }

    return sortedGroups;
  })();

  const filteredDets = allDetecciones.filter(d => !detSearch || d.nombre.toLowerCase().includes(detSearch.toLowerCase()));

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 overflow-x-auto">
          <Link href="/" className="hover:text-foreground transition-colors whitespace-nowrap">
            Capacitaciones
          </Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-foreground font-medium whitespace-nowrap">{year.year}</span>
        </div>

        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Capacitaciones {year.year}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
              Gestión de cursos del año {year.year}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              variant="outline"
              onClick={handleDeleteClick}
              className="text-red-600 hover:text-red-700 w-full sm:w-auto"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              <span className="sm:inline">Eliminar Año</span>
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#2166be] hover:bg-[#1a5299] text-white w-full sm:w-auto"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Curso
            </Button>
            <Button
              onClick={openDetPicker}
              variant="outline"
              className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white w-full sm:w-auto"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear a partir de detección
            </Button>
          </div>
        </div>

        {courses.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar curso..."
                className="pl-9 w-full bg-white h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              >
                <option value="desc">Más reciente primero</option>
                <option value="asc">Más antiguo primero</option>
              </select>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No hay cursos creados para este año
            </h3>
            <p className="text-muted-foreground mb-6">
              Comienza creando tu primer curso de capacitación
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#2166be] hover:bg-[#1a5299] text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Curso
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedCourses.map((group) => (
              <div key={group.sortKey} className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground border-b pb-2">{group.label}</h2>
                <div className="space-y-4">
                  {group.courses.map((course) => (
                    <div key={course.id} className="relative group/row">
                      <CourseCard course={course} />
                      <div
                        className="absolute bottom-3 right-8 flex items-center gap-1
                                   opacity-0 group-hover/row:opacity-100 transition-opacity z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Renombrar curso"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/80"
                          onClick={(e) => handleRenameCourseClick(e, course)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar curso"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => handleDeleteCourseClick(e, course)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateCourseModal
        open={isCreateModalOpen}
        onOpenChange={(v) => { setIsCreateModalOpen(v); if (!v) setCreateFromDet(null); }}
        onSuccess={handleCourseCreated}
        yearId={params.id as string}
        plantId={plantId || ''}
        prefill={createFromDet ? {
          name: createFromDet.nombre,
          instInterno: !!createFromDet.inst_interno,
          proveedorSugerido: createFromDet.proveedor_sugerido || '',
          costo: createFromDet.costo != null ? String(createFromDet.costo) : '',
          fechaProgramada: createFromDet.fecha_programada || '',
          fechaReal: createFromDet.fecha_real || '',
          durationHours: createFromDet.duration_hours != null ? String(createFromDet.duration_hours) : '',
          desarrolloPersonal: createFromDet.desarrollo_personal ?? false,
          habilidadesBlandas: createFromDet.habilidades_blandas ?? false,
          prevencionRiesgos: createFromDet.prevencion_riesgos ?? false,
          habilidadesTecnicas: createFromDet.habilidades_tecnicas ?? false,
          comentarioDnc: createFromDet.comentario_dnc || '',
        } : undefined}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, hasCourses: deleteDialog.hasCourses })
        }
        title={deleteDialog.hasCourses ? "¿Eliminar año con todos sus cursos?" : "¿Eliminar año?"}
        description={
          deleteDialog.hasCourses
            ? `Este año contiene ${courses.length} curso(s). Al eliminar el año, se eliminarán TODOS los cursos y sus cuestionarios asociados. Esta acción es irreversible y no se puede deshacer. ¿Estás seguro de continuar?`
            : `¿Estás seguro de que deseas eliminar el año ${year.year}? Esta acción no se puede deshacer.`
        }
        confirmText="Eliminar Año"
        onConfirm={handleDeleteYear}
        variant="destructive"
      />

      <ConfirmDialog
        open={deleteCourseDialog.open}
        onOpenChange={(open) => setDeleteCourseDialog({ open, course: deleteCourseDialog.course })}
        title="¿Eliminar curso?"
        description={`¿Estás seguro de que deseas eliminar el curso "${deleteCourseDialog.course?.name}"? Se eliminarán todos sus participantes y registros asociados. Esta acción no se puede deshacer.`}
        confirmText="Eliminar Curso"
        onConfirm={handleDeleteCourse}
        variant="destructive"
      />

      <Dialog
        open={renameCourseDialog.open}
        onOpenChange={(open) => setRenameCourseDialog({ open, course: renameCourseDialog.course })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renombrar Curso</DialogTitle>
            <DialogDescription>
              Ingresa el nuevo nombre para el curso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="rename-course-input">Nombre del Curso</Label>
            <Input
              id="rename-course-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameCourse()}
              placeholder="Nombre del curso"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameCourseDialog({ open: false, course: null })}
              disabled={isRenameSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRenameCourse}
              disabled={isRenameSaving || !renameValue.trim()}
              className="bg-[#2166be] hover:bg-[#1a5299] text-white"
            >
              {isRenameSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detección picker dialog */}
      <Dialog open={detPickerOpen} onOpenChange={v => { setDetPickerOpen(v); if (!v) setDetSearch(''); }}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Crear a partir de Detección</DialogTitle>
            <DialogDescription>Selecciona una detección para pre-llenar el formulario del curso</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            <Input
              placeholder="Buscar por nombre..."
              value={detSearch}
              onChange={e => setDetSearch(e.target.value)}
            />
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {filteredDets.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">
                  {detSearch ? 'Sin resultados' : 'No hay detecciones registradas'}
                </p>
              ) : filteredDets.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-md border border-transparent hover:border-[#2166be] hover:bg-blue-50 transition-colors text-left"
                  onClick={() => selectDeteccion(d)}
                >
                  {d.status && <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOTS[d.status] ?? 'bg-gray-400'}`} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.status ? STATUS_LABELS[d.status] : 'Sin status'}
                      {d.fecha_programada ? ` · ${fmtDate(d.fecha_programada)}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetPickerOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

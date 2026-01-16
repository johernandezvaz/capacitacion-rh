"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, ChevronRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/course-card';
import { CreateCourseModal } from '@/components/create-course-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { supabase, TrainingYear, Course } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function YearDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [year, setYear] = useState<TrainingYear | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    hasCourses: false,
  });

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
        .order('date', { ascending: true });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);
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

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">
            Capacitaciones
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{year.year}</span>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Capacitaciones {year.year}
            </h1>
            <p className="text-muted-foreground text-lg">
              Gestión de cursos del año {year.year}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleDeleteClick}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Eliminar Año
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#2166be] hover:bg-[#1a5299] text-white"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Curso
            </Button>
          </div>
        </div>

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
          <div className="space-y-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>

      <CreateCourseModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCourseCreated}
        yearId={params.id as string}
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
    </div>
  );
}

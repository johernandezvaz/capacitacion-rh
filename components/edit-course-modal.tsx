"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types/database';

interface EditCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  onSuccess: () => void;
}

export function EditCourseModal({
  open,
  onOpenChange,
  course,
  onSuccess,
}: EditCourseModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: course.name,
    date: course.date,
    duration_hours: course.duration_hours,
  });

  const [errors, setErrors] = useState({
    name: '',
    date: '',
    duration_hours: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: course.name,
        date: course.date,
        duration_hours: course.duration_hours,
      });
      setErrors({ name: '', date: '', duration_hours: '' });
    }
  }, [open, course]);

  const validateForm = (): boolean => {
    const newErrors = {
      name: '',
      date: '',
      duration_hours: '',
    };

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    if (formData.duration_hours <= 0) {
      newErrors.duration_hours = 'La duración debe ser mayor a 0';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== '');
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          date: formData.date,
          duration_hours: formData.duration_hours,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'No se pudo actualizar el curso');
      }

      toast({
        title: 'Éxito',
        description: 'Curso actualizado correctamente',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error updating course:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el curso',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Curso</DialogTitle>
          <DialogDescription>
            Modifica la información del curso. Los cambios se reflejarán en todos los cuestionarios asociados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre del Curso <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej: Seguridad Industrial"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">
              Fecha del Curso <span className="text-red-500">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
            {errors.date && (
              <p className="text-sm text-red-600">{errors.date}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">
              Duración (horas) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="duration"
              type="number"
              min="0.1"
              step="any"
              value={formData.duration_hours}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  duration_hours: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="Ej: 8"
            />
            {errors.duration_hours && (
              <p className="text-sm text-red-600">{errors.duration_hours}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

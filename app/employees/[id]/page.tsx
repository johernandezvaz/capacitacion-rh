"use client";

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, Employee } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/components/protected-route';

export default function EmployeeEditPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { toast } = useToast();

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        employee_number: '',
        nombre: '',
        area: '',
        puesto: '',
        evaluador: '',
    });

    const [errors, setErrors] = useState({
        employee_number: '',
        nombre: '',
        area: '',
        puesto: '',
        evaluador: '',
    });

    useEffect(() => {
        fetchEmployee();
    }, [resolvedParams.id]);

    const fetchEmployee = async () => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('id', resolvedParams.id)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                toast({
                    title: 'Error',
                    description: 'Empleado no encontrado',
                    variant: 'destructive',
                });
                router.push('/employees');
                return;
            }

            setEmployee(data);
            setFormData({
                employee_number: data.employee_number,
                nombre: data.nombre,
                area: data.area,
                puesto: data.puesto,
                evaluador: data.evaluador,
            });
        } catch (error) {
            console.error('Error fetching employee:', error);
            toast({
                title: 'Error',
                description: 'No se pudo cargar el empleado',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const newErrors = {
            employee_number: '',
            nombre: '',
            area: '',
            puesto: '',
            evaluador: '',
        };

        if (!formData.employee_number.trim()) {
            newErrors.employee_number = 'El número de empleado es requerido';
        }

        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido';
        }

        if (!formData.area.trim()) {
            newErrors.area = 'El área es requerida';
        }

        if (!formData.puesto.trim()) {
            newErrors.puesto = 'El puesto es requerido';
        }

        if (!formData.evaluador.trim()) {
            newErrors.evaluador = 'El evaluador es requerido';
        }

        setErrors(newErrors);
        return !Object.values(newErrors).some((error) => error !== '');
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setIsSaving(true);
        try {
            if (formData.employee_number !== employee?.employee_number) {
                const { data: existing } = await supabase
                    .from('employees')
                    .select('id')
                    .eq('employee_number', formData.employee_number)
                    .maybeSingle();

                if (existing) {
                    setErrors({
                        ...errors,
                        employee_number: 'Este número de empleado ya existe',
                    });
                    setIsSaving(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('employees')
                .update({
                    employee_number: formData.employee_number.trim(),
                    nombre: formData.nombre.trim(),
                    area: formData.area.trim(),
                    puesto: formData.puesto.trim(),
                    evaluador: formData.evaluador.trim(),
                })
                .eq('id', resolvedParams.id);

            if (error) throw error;

            toast({
                title: 'Éxito',
                description: 'Empleado actualizado correctamente',
            });

            router.push('/employees');
        } catch (error: any) {
            console.error('Error updating employee:', error);
            toast({
                title: 'Error',
                description: error.message || 'No se pudo actualizar el empleado',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-muted rounded w-64" />
                        <div className="h-64 bg-muted rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (!employee) return null;

    return (
        <ProtectedRoute>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-3xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/employees')}
                    className="mb-4 sm:mb-6"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a empleados
                </Button>

                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl sm:text-2xl">Editar Empleado</CardTitle>
                        <CardDescription className="text-sm sm:text-base">
                            Modifica la información del empleado. Los cambios se reflejarán en todos los cursos y cuestionarios asociados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="employee_number">
                                Número de Empleado <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="employee_number"
                                value={formData.employee_number}
                                onChange={(e) =>
                                    setFormData({ ...formData, employee_number: e.target.value })
                                }
                                placeholder="Ej: EMP001"
                            />
                            {errors.employee_number && (
                                <p className="text-sm text-red-600">{errors.employee_number}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nombre">
                                Nombre Completo <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="nombre"
                                value={formData.nombre}
                                onChange={(e) =>
                                    setFormData({ ...formData, nombre: e.target.value })
                                }
                                placeholder="Ej: Juan Pérez García"
                            />
                            {errors.nombre && (
                                <p className="text-sm text-red-600">{errors.nombre}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="area">
                                Área <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="area"
                                value={formData.area}
                                onChange={(e) =>
                                    setFormData({ ...formData, area: e.target.value })
                                }
                                placeholder="Ej: Recursos Humanos"
                            />
                            {errors.area && (
                                <p className="text-sm text-red-600">{errors.area}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="puesto">
                                Puesto <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="puesto"
                                value={formData.puesto}
                                onChange={(e) =>
                                    setFormData({ ...formData, puesto: e.target.value })
                                }
                                placeholder="Ej: Analista"
                            />
                            {errors.puesto && (
                                <p className="text-sm text-red-600">{errors.puesto}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="evaluador">
                                Evaluador <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="evaluador"
                                value={formData.evaluador}
                                onChange={(e) =>
                                    setFormData({ ...formData, evaluador: e.target.value })
                                }
                                placeholder="Ej: María González"
                            />
                            {errors.evaluador && (
                                <p className="text-sm text-red-600">{errors.evaluador}</p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 w-full sm:w-auto"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => router.push('/employees')}
                                disabled={isSaving}
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </ProtectedRoute>
    );
}

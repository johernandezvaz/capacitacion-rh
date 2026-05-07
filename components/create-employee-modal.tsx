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
import { supabase, Departamento } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { DepartmentCombobox } from '@/components/department-combobox';

interface CreateEmployeeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (employeeId: string) => void;
    plantId: string;
    departamentos?: Departamento[];
}

export function CreateEmployeeModal({
    open,
    onOpenChange,
    onSuccess,
    plantId,
    departamentos = [],
}: CreateEmployeeModalProps) {
    const [formData, setFormData] = useState({
        employee_number: '',
        nombre: '',
        area: '',
        puesto: '',
        evaluador: '',
        departamento_id: null as string | null,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { toast } = useToast();

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.employee_number.trim()) {
            newErrors.employee_number = 'El número de empleado es obligatorio';
        }
        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es obligatorio';
        }
        if (!formData.area.trim()) {
            newErrors.area = 'El área es obligatoria';
        }
        if (!formData.puesto.trim()) {
            newErrors.puesto = 'El puesto es obligatorio';
        }
        if (!formData.evaluador.trim()) {
            newErrors.evaluador = 'El evaluador es obligatorio';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);

        try {
            const { data, error: insertError } = await supabase
                .from('employees')
                .insert([{
                    employee_number: formData.employee_number.trim(),
                    nombre: formData.nombre.trim(),
                    area: formData.area.trim(),
                    puesto: formData.puesto.trim(),
                    evaluador: formData.evaluador.trim(),
                    departamento_id: formData.departamento_id || null,
                    plant_id: plantId || null,
                }])
                .select()
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    setErrors({ employee_number: 'Este número de empleado ya existe' });
                } else {
                    throw insertError;
                }
                return;
            }

            toast({
                title: 'Empleado creado',
                description: 'El empleado fue creado exitosamente',
            });

            setFormData({
                employee_number: '',
                nombre: '',
                area: '',
                puesto: '',
                evaluador: '',
                departamento_id: null,
            });

            onSuccess(data.id);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo crear el empleado',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            employee_number: '',
            nombre: '',
            area: '',
            puesto: '',
            evaluador: '',
            departamento_id: null,
        });
        setErrors({});
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Crear Nuevo Empleado</DialogTitle>
                    <DialogDescription>
                        Complete todos los campos para registrar un nuevo empleado en el sistema
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="employee_number">Número de Empleado</Label>
                            <Input
                                id="employee_number"
                                type="text"
                                placeholder="Ej: EMP-001"
                                value={formData.employee_number}
                                onChange={(e) => handleChange('employee_number', e.target.value)}
                                required
                            />
                            {errors.employee_number && (
                                <p className="text-sm text-destructive">{errors.employee_number}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre Completo</Label>
                            <Input
                                id="nombre"
                                type="text"
                                placeholder="Ej: Juan Pérez García"
                                value={formData.nombre}
                                onChange={(e) => handleChange('nombre', e.target.value)}
                                required
                            />
                            {errors.nombre && (
                                <p className="text-sm text-destructive">{errors.nombre}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="area">Área</Label>
                            <Input
                                id="area"
                                type="text"
                                placeholder="Ej: Recursos Humanos"
                                value={formData.area}
                                onChange={(e) => handleChange('area', e.target.value)}
                                required
                            />
                            {errors.area && (
                                <p className="text-sm text-destructive">{errors.area}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Departamento</Label>
                            <DepartmentCombobox
                                departamentos={departamentos}
                                value={formData.departamento_id}
                                onChange={(id) => setFormData(prev => ({ ...prev, departamento_id: id }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="puesto">Puesto</Label>
                            <Input
                                id="puesto"
                                type="text"
                                placeholder="Ej: Analista de Capacitación"
                                value={formData.puesto}
                                onChange={(e) => handleChange('puesto', e.target.value)}
                                required
                            />
                            {errors.puesto && (
                                <p className="text-sm text-destructive">{errors.puesto}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="evaluador">Evaluador</Label>
                            <Input
                                id="evaluador"
                                type="text"
                                placeholder="Ej: María López (Supervisor)"
                                value={formData.evaluador}
                                onChange={(e) => handleChange('evaluador', e.target.value)}
                                required
                            />
                            {errors.evaluador && (
                                <p className="text-sm text-destructive">{errors.evaluador}</p>
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
                            {isLoading ? 'Creando...' : 'Crear Empleado'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

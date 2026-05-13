"use client";

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, BarChart2, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase, Employee } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { STATUS_CONFIG, fmtDate } from '@/lib/detecciones-utils';

export default function EmployeeEditPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { toast } = useToast();

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    type DetRow = { id: string; nombre: string; status: string | null; fecha_programada: string | null; fecha_real: string | null; };
    const [detecciones, setDetecciones] = useState<DetRow[]>([]);

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

    const fetchDetecciones = async () => {
        const { data } = await supabase
            .from('deteccion_empleados')
            .select('detecciones!deteccion_id(id, nombre, status, fecha_programada, fecha_real)')
            .eq('employee_id', resolvedParams.id)
            .order('detecciones(created_at)', { ascending: false });
        if (data) setDetecciones((data as any[]).map(r => r.detecciones).filter(Boolean));
    };

    useEffect(() => {
        fetchEmployee();
        fetchDetecciones();
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
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/employees')}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a empleados
                    </Button>
                    <Link href={`/employees/${resolvedParams.id}/dnc`}>
                        <Button variant="outline" className="flex items-center gap-2">
                            <BarChart2 className="w-4 h-4" />
                            Ver DNC
                        </Button>
                    </Link>
                </div>

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

                <Card className="border-none shadow-lg mt-8">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-lg font-semibold text-[#192b52]">Detecciones</CardTitle>
                        <CardDescription className="text-sm">
                            Detecciones de necesidad de capacitación asignadas a este empleado
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {detecciones.length === 0 ? (
                            <p className="text-muted-foreground text-sm py-6 text-center">Sin detecciones asignadas.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            {['Nombre', 'Status', 'Fecha Programada', 'Fecha Real', 'Ver'].map(h => (
                                                <th key={h} className={`py-3 px-4 text-sm font-semibold text-[#192b52] ${h === 'Ver' ? 'text-right' : 'text-left'}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detecciones.map((d, i) => {
                                            const cfg = d.status ? STATUS_CONFIG[d.status] : null;
                                            return (
                                                <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                                                    <td className="py-3 px-4 text-sm font-medium">{d.nombre}</td>
                                                    <td className="py-3 px-4">
                                                        {cfg ? (
                                                            <Badge className={cfg.bg}>{cfg.label}</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">{fmtDate(d.fecha_programada)}</td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">{fmtDate(d.fecha_real)}</td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button size="sm" variant="ghost" className="text-[#2166be] hover:text-[#1a5299] hover:bg-blue-50" onClick={() => router.push('/detecciones')}>
                                                            <Eye className="w-3.5 h-3.5 mr-1" />Ver
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

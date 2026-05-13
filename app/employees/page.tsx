"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase, Employee } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CreateEmployeeModal } from '@/components/create-employee-modal';
import { useAuth } from '@/contexts/auth-context';

export default function EmployeesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { plantId } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterArea, setFilterArea] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        employee: Employee | null;
        hasActiveCourses: boolean;
    }>({
        open: false,
        employee: null,
        hasActiveCourses: false,
    });

    const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
    const [editingAreaValue, setEditingAreaValue] = useState('');
    const [savingAreaId, setSavingAreaId] = useState<string | null>(null);
    const areaInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!plantId) return;
        fetchEmployees();
    }, [plantId]);

    useEffect(() => {
        if (editingAreaId && areaInputRef.current) {
            areaInputRef.current.focus();
            areaInputRef.current.select();
        }
    }, [editingAreaId]);

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('plant_id', plantId)
                .order('nombre');

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los empleados',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const uniqueAreas = useMemo(() => {
        const areas = Array.from(new Set(employees.map(e => e.area).filter(Boolean))).sort();
        return areas;
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        let result = employees;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                emp =>
                    emp.nombre.toLowerCase().includes(q) ||
                    emp.employee_number.toLowerCase().includes(q) ||
                    emp.area.toLowerCase().includes(q) ||
                    emp.puesto.toLowerCase().includes(q)
            );
        }
        if (filterArea) {
            result = result.filter(emp => emp.area === filterArea);
        }
        return result;
    }, [employees, searchQuery, filterArea]);

    const startEditArea = (employee: Employee) => {
        setEditingAreaId(employee.id);
        setEditingAreaValue(employee.area);
    };

    const cancelEditArea = () => {
        setEditingAreaId(null);
        setEditingAreaValue('');
    };

    const saveEditArea = async (employeeId: string) => {
        const newValue = editingAreaValue.trim();
        const original = employees.find(e => e.id === employeeId);
        if (!original) { cancelEditArea(); return; }
        if (newValue === original.area) { cancelEditArea(); return; }

        setSavingAreaId(employeeId);
        try {
            const { error } = await supabase
                .from('employees')
                .update({ area: newValue })
                .eq('id', employeeId);

            if (error) throw error;

            setEmployees(prev =>
                prev.map(e => e.id === employeeId ? { ...e, area: newValue } : e)
            );
            setEditingAreaId(null);
            setEditingAreaValue('');
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo actualizar el área',
                variant: 'destructive',
            });
            setEditingAreaValue(original.area);
        } finally {
            setSavingAreaId(null);
        }
    };

    const handleAreaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, employeeId: string) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEditArea(employeeId); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelEditArea(); }
    };

    const handleDeleteClick = async (employee: Employee) => {
        const { data: participants } = await supabase
            .from('course_participants')
            .select('id')
            .eq('employee_id', employee.id);

        setDeleteDialog({
            open: true,
            employee,
            hasActiveCourses: (participants?.length || 0) > 0,
        });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteDialog.employee) return;

        try {
            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', deleteDialog.employee.id);

            if (error) throw error;

            toast({ title: 'Éxito', description: 'Empleado eliminado correctamente' });
            fetchEmployees();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo eliminar el empleado',
                variant: 'destructive',
            });
        } finally {
            setDeleteDialog({ open: false, employee: null, hasActiveCourses: false });
        }
    };

    const handleEmployeeCreated = () => {
        fetchEmployees();
        setIsCreateModalOpen(false);
        toast({ title: 'Éxito', description: 'Empleado creado correctamente' });
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

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                            Empleados
                        </h1>
                        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                            Gestión de empleados del sistema
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-[#2166be] hover:bg-[#1a5299] text-white w-full sm:w-auto"
                        size="lg"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nuevo Empleado
                    </Button>
                </div>

                <Card className="mb-6 border-none shadow-lg">
                    <CardHeader>
                        <CardTitle>Buscar Empleados</CardTitle>
                        <CardDescription>
                            Busca por nombre, número de empleado, área o puesto
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <Input
                                    placeholder="Buscar empleados..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            {uniqueAreas.length > 0 && (
                                <select
                                    value={filterArea}
                                    onChange={e => setFilterArea(e.target.value)}
                                    className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2166be] sm:min-w-[220px]"
                                >
                                    <option value="">Todas las áreas</option>
                                    {uniqueAreas.map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <CardTitle className="text-lg sm:text-xl">Listado de Empleados</CardTitle>
                            <Badge variant="secondary" className="w-fit">
                                {filteredEmployees.length} empleados
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredEmployees.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground text-sm sm:text-base">
                                    {searchQuery || filterArea ? 'No se encontraron empleados' : 'No hay empleados registrados'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* ── Vista desktop ── */}
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-semibold text-sm">Número</th>
                                                <th className="text-left py-3 px-4 font-semibold text-sm">Nombre</th>
                                                <th className="text-left py-3 px-4 font-semibold text-sm">
                                                    Área
                                                    <span className="ml-1 text-xs font-normal text-muted-foreground">(click para editar)</span>
                                                </th>
                                                <th className="text-left py-3 px-4 font-semibold text-sm">Puesto</th>
                                                <th className="text-left py-3 px-4 font-semibold text-sm">Evaluador</th>
                                                <th className="text-right py-3 px-4 font-semibold text-sm">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEmployees.map((employee) => (
                                                <tr key={employee.id} className="border-b hover:bg-muted/50">
                                                    <td className="py-3 px-4 text-sm">{employee.employee_number}</td>
                                                    <td className="py-3 px-4 text-sm font-medium">{employee.nombre}</td>

                                                    <td
                                                        className="py-2 px-4 text-sm"
                                                        onClick={() => {
                                                            if (editingAreaId !== employee.id) startEditArea(employee);
                                                        }}
                                                    >
                                                        {editingAreaId === employee.id ? (
                                                            <input
                                                                ref={areaInputRef}
                                                                type="text"
                                                                value={editingAreaValue}
                                                                onChange={e => setEditingAreaValue(e.target.value)}
                                                                onBlur={() => saveEditArea(employee.id)}
                                                                onKeyDown={e => handleAreaKeyDown(e, employee.id)}
                                                                disabled={savingAreaId === employee.id}
                                                                className={`
                                                                    h-8 w-full rounded border px-2 text-sm bg-white
                                                                    border-[#2166be] ring-1 ring-[#2166be] outline-none
                                                                    ${savingAreaId === employee.id ? 'opacity-50 cursor-not-allowed' : ''}
                                                                `}
                                                            />
                                                        ) : (
                                                            <span className="cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-blue-50 hover:text-[#2166be] transition-colors">
                                                                {employee.area || <span className="text-muted-foreground italic">—</span>}
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-4 text-sm">{employee.puesto}</td>
                                                    <td className="py-3 px-4 text-sm">{employee.evaluador}</td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Link href={`/employees/${employee.id}/dnc`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-[#2166be] hover:text-[#1a5299] hover:bg-blue-50"
                                                                    title="Ver DNC"
                                                                >
                                                                    <BarChart2 className="w-4 h-4 mr-1" />
                                                                    DNC
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => router.push(`/employees/${employee.id}`)}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteClick(employee)}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* ── Vista móvil ── */}
                                <div className="lg:hidden space-y-3">
                                    {filteredEmployees.map((employee) => (
                                        <div key={employee.id} className="border rounded-lg p-4 space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-blue-600 font-semibold mb-1">
                                                        {employee.employee_number}
                                                    </p>
                                                    <p className="font-medium text-sm mb-2 break-words">{employee.nombre}</p>
                                                    <div className="text-xs text-muted-foreground space-y-1">
                                                        <p className="flex items-center gap-1">
                                                            <span className="font-medium">Área:</span>
                                                            {editingAreaId === employee.id ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingAreaValue}
                                                                    onChange={e => setEditingAreaValue(e.target.value)}
                                                                    onBlur={() => saveEditArea(employee.id)}
                                                                    onKeyDown={e => handleAreaKeyDown(e, employee.id)}
                                                                    disabled={savingAreaId === employee.id}
                                                                    autoFocus
                                                                    className={`
                                                                        h-7 flex-1 rounded border px-2 text-xs bg-white
                                                                        border-[#2166be] ring-1 ring-[#2166be] outline-none
                                                                        ${savingAreaId === employee.id ? 'opacity-50 cursor-not-allowed' : ''}
                                                                    `}
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-blue-50 hover:text-[#2166be] transition-colors"
                                                                    onClick={() => startEditArea(employee)}
                                                                >
                                                                    {employee.area || <span className="italic">—</span>}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p><span className="font-medium">Puesto:</span> {employee.puesto}</p>
                                                        <p><span className="font-medium">Evaluador:</span> {employee.evaluador}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <Link href={`/employees/${employee.id}/dnc`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-[#2166be] hover:text-[#1a5299] hover:bg-blue-50"
                                                            title="Ver DNC"
                                                        >
                                                            <BarChart2 className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => router.push(`/employees/${employee.id}`)}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteClick(employee)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <CreateEmployeeModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSuccess={handleEmployeeCreated}
                plantId={plantId || ''}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog({ open, employee: null, hasActiveCourses: false })
                }
                title={
                    deleteDialog.hasActiveCourses
                        ? "No se puede eliminar el empleado"
                        : "¿Eliminar empleado?"
                }
                description={
                    deleteDialog.hasActiveCourses
                        ? `El empleado ${deleteDialog.employee?.nombre} tiene cursos asociados. No es posible eliminarlo mientras tenga historial activo.`
                        : `¿Estás seguro de que deseas eliminar a ${deleteDialog.employee?.nombre}? Esta acción no se puede deshacer.`
                }
                confirmText={deleteDialog.hasActiveCourses ? "Entendido" : "Eliminar"}
                onConfirm={
                    deleteDialog.hasActiveCourses
                        ? () => setDeleteDialog({ open: false, employee: null, hasActiveCourses: false })
                        : handleDeleteConfirm
                }
                variant={deleteDialog.hasActiveCourses ? "default" : "destructive"}
            />
        </div>
    );
}

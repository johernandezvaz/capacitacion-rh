"use client";

import { useState } from 'react';
import { CheckCircle2, Clock, Lock, FileText, Trash2, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { EmployeeWithQuestionnaires, supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from './confirm-dialog';

interface EmployeeListProps {
    employees: EmployeeWithQuestionnaires[];
    onRefresh: () => void;
}

export function EmployeeList({ employees, onRefresh }: EmployeeListProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        employee: EmployeeWithQuestionnaires | null;
    }>({
        open: false,
        employee: null,
    });
    const [loadingReports, setLoadingReports] = useState<Record<string, boolean>>({});

    const getHotQuestionnaireStatus = (employee: EmployeeWithQuestionnaires) => {
        if (!employee.hot_questionnaire) {
            return {
                label: 'Sin cuestionario',
                color: 'bg-slate-100 text-slate-800',
                icon: <FileText className="w-4 h-4" />,
                canClick: false,
            };
        }

        if (employee.hot_questionnaire.submitted_at !== null) {
            return {
                label: 'Completado',
                color: 'bg-green-100 text-green-800',
                icon: <CheckCircle2 className="w-4 h-4" />,
                canClick: true,
                url: `/questionnaire/hot/${employee.hot_questionnaire.id}`,
            };
        }

        return {
            label: 'Pendiente',
            color: 'bg-amber-100 text-amber-800',
            icon: <Clock className="w-4 h-4" />,
            canClick: true,
            url: `/questionnaire/hot/${employee.hot_questionnaire.id}`,
        };
    };

    const canGenerateHotReport = (employee: EmployeeWithQuestionnaires): boolean => {
        return employee.hot_questionnaire?.submitted_at !== null;
    };

    const canGenerateColdReport = (employee: EmployeeWithQuestionnaires): boolean => {
        const hasHot = employee.hot_questionnaire?.submitted_at !== null;
        const coldQ = employee.cold_questionnaire;

        if (!hasHot || !coldQ) return false;

        const hasEvaluatorSignature = coldQ.evaluator_signed_at !== null;
        const hasEmployeeSignature = coldQ.employee_signed_at !== null;

        return hasEvaluatorSignature && hasEmployeeSignature;
    };

    const handleDownloadReport = async (employee: EmployeeWithQuestionnaires, type: 'hot' | 'cold') => {
        const reportKey = `${employee.participant_id}-${type}`;
        setLoadingReports(prev => ({ ...prev, [reportKey]: true }));

        try {
            const courseId = employee.course_id || (employee as any).course_participants?.[0]?.course_id;
            if (!courseId) {
                throw new Error('No se pudo determinar el ID del curso');
            }

            const response = await fetch(
                `/api/course-report/${courseId}?type=${type}&participantId=${employee.participant_id}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al generar reporte');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const reportType = type === 'hot' ? 'Empleado' : 'Evaluador';
            a.download = `Reporte_${reportType}_${employee.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: 'Éxito',
                description: `Reporte ${type === 'hot' ? 'empleado' : 'evaluador'} generado exitosamente`,
            });
        } catch (error: any) {
            console.error('Error downloading report:', error);
            toast({
                title: 'Error',
                description: error.message || 'No se pudo generar el reporte',
                variant: 'destructive',
            });
        } finally {
            setLoadingReports(prev => ({ ...prev, [reportKey]: false }));
        }
    };

    const handleDeleteParticipant = async () => {
        if (!deleteDialog.employee) return;

        try {
            const { error: questionnairesError } = await supabase
                .from('questionnaires')
                .delete()
                .eq('course_participant_id', deleteDialog.employee.participant_id);

            if (questionnairesError) throw questionnairesError;

            const { error: participantError } = await supabase
                .from('course_participants')
                .delete()
                .eq('id', deleteDialog.employee.participant_id);

            if (participantError) throw participantError;

            toast({
                title: 'Éxito',
                description: 'Participante eliminado del curso',
            });

            onRefresh();
        } catch (error: any) {
            console.error('Error deleting participant:', error);
            toast({
                title: 'Error',
                description: error.message || 'No se pudo eliminar el participante',
                variant: 'destructive',
            });
        } finally {
            setDeleteDialog({ open: false, employee: null });
        }
    };

    const getColdQuestionnaireStatus = (employee: EmployeeWithQuestionnaires) => {
        if (!employee.cold_questionnaire) {
            return {
                label: 'Sin cuestionario',
                color: 'bg-slate-100 text-slate-600',
                icon: <Lock className="w-4 h-4" />,
                description: 'No disponible',
                canClick: false,
            };
        }

        const now = new Date();
        const availableDate = new Date(employee.cold_questionnaire.available_from);
        const isAvailable = now >= availableDate;

        if (employee.cold_questionnaire.submitted_at !== null) {
            return {
                label: 'Completado',
                color: 'bg-green-100 text-green-800',
                icon: <CheckCircle2 className="w-4 h-4" />,
                canClick: true,
                url: `/questionnaire/cold/${employee.cold_questionnaire.id}`,
            };
        }

        if (!isAvailable) {
            return {
                label: 'Bloqueado',
                color: 'bg-slate-100 text-slate-600',
                icon: <Lock className="w-4 h-4" />,
                description: `Disponible: ${availableDate.toLocaleDateString('es-MX')}`,
                canClick: true,
                url: `/questionnaire/cold/${employee.cold_questionnaire.id}`,
            };
        }

        return {
            label: 'Pendiente',
            color: 'bg-amber-100 text-amber-800',
            icon: <Clock className="w-4 h-4" />,
            canClick: true,
            url: `/questionnaire/cold/${employee.cold_questionnaire.id}`,
        };
    };

    if (employees.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    No hay empleados inscritos
                </h3>
                <p className="text-muted-foreground">
                    Usa el buscador de arriba para agregar empleados a este curso
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="hidden lg:block rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">N° Empleado</TableHead>
                            <TableHead className="font-semibold">Nombre</TableHead>
                            <TableHead className="font-semibold">Área</TableHead>
                            <TableHead className="font-semibold">Puesto</TableHead>
                            <TableHead className="font-semibold text-center">Cuestionario Empleado</TableHead>
                            <TableHead className="font-semibold text-center">Cuestionario Evaluador</TableHead>
                            <TableHead className="font-semibold text-center">Reportes</TableHead>
                            <TableHead className="font-semibold text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {employees.map((employee) => {
                            const hotStatus = getHotQuestionnaireStatus(employee);
                            const coldStatus = getColdQuestionnaireStatus(employee);

                            return (
                                <TableRow key={employee.id} className="hover:bg-slate-50">
                                    <TableCell className="font-mono font-semibold text-blue-600">
                                        {employee.employee_number}
                                    </TableCell>
                                    <TableCell className="font-medium">{employee.nombre}</TableCell>
                                    <TableCell className="text-muted-foreground">{employee.area}</TableCell>
                                    <TableCell className="text-muted-foreground">{employee.puesto}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center">
                                            {hotStatus.canClick && hotStatus.url ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(hotStatus.url)}
                                                    className="h-auto p-0 hover:bg-transparent"
                                                >
                                                    <Badge className={`${hotStatus.color} flex items-center gap-1.5 px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity`}>
                                                        {hotStatus.icon}
                                                        {hotStatus.label}
                                                    </Badge>
                                                </Button>
                                            ) : (
                                                <Badge className={`${hotStatus.color} flex items-center gap-1.5 px-3 py-1`}>
                                                    {hotStatus.icon}
                                                    {hotStatus.label}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            {coldStatus.canClick && coldStatus.url ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(coldStatus.url)}
                                                    className="h-auto p-0 hover:bg-transparent"
                                                >
                                                    <Badge className={`${coldStatus.color} flex items-center gap-1.5 px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity`}>
                                                        {coldStatus.icon}
                                                        {coldStatus.label}
                                                    </Badge>
                                                </Button>
                                            ) : (
                                                <Badge className={`${coldStatus.color} flex items-center gap-1.5 px-3 py-1`}>
                                                    {coldStatus.icon}
                                                    {coldStatus.label}
                                                </Badge>
                                            )}
                                            {coldStatus.description && (
                                                <span className="text-xs text-muted-foreground">
                                                    {coldStatus.description}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col gap-1.5 items-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownloadReport(employee, 'hot')}
                                                disabled={!canGenerateHotReport(employee) || loadingReports[`${employee.participant_id}-hot`]}
                                                className="w-full min-w-[120px] text-xs"
                                            >
                                                <Download className="w-3 h-3 mr-1" />
                                                {loadingReports[`${employee.participant_id}-hot`] ? 'Generando...' : 'Empleado'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownloadReport(employee, 'cold')}
                                                disabled={!canGenerateColdReport(employee) || loadingReports[`${employee.participant_id}-cold`]}
                                                className="w-full min-w-[120px] text-xs"
                                            >
                                                <Download className="w-3 h-3 mr-1" />
                                                {loadingReports[`${employee.participant_id}-cold`] ? 'Generando...' : 'Evaluador'}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setDeleteDialog({
                                                    open: true,
                                                    employee,
                                                })
                                            }
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="lg:hidden space-y-4">
                {employees.map((employee) => {
                    const hotStatus = getHotQuestionnaireStatus(employee);
                    const coldStatus = getColdQuestionnaireStatus(employee);

                    return (
                        <div key={employee.id} className="bg-white rounded-lg border p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-blue-600 mb-1">
                                        {employee.employee_number}
                                    </p>
                                    <p className="font-medium text-base mb-1 break-words">
                                        {employee.nombre}
                                    </p>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <p><span className="font-medium">Área:</span> {employee.area}</p>
                                        <p><span className="font-medium">Puesto:</span> {employee.puesto}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setDeleteDialog({
                                            open: true,
                                            employee,
                                        })
                                    }
                                    className="flex-shrink-0"
                                >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                            </div>

                            <div className="border-t pt-3 space-y-2">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Cuestionario Empleado
                                    </p>
                                    {hotStatus.canClick && hotStatus.url ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(hotStatus.url)}
                                            className="h-auto p-0 hover:bg-transparent w-full justify-start"
                                        >
                                            <Badge className={`${hotStatus.color} flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:opacity-80 transition-opacity w-full justify-center`}>
                                                {hotStatus.icon}
                                                {hotStatus.label}
                                            </Badge>
                                        </Button>
                                    ) : (
                                        <Badge className={`${hotStatus.color} flex items-center gap-1.5 px-3 py-1.5 w-full justify-center`}>
                                            {hotStatus.icon}
                                            {hotStatus.label}
                                        </Badge>
                                    )}
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Cuestionario Evaluador
                                    </p>
                                    {coldStatus.canClick && coldStatus.url ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(coldStatus.url)}
                                            className="h-auto p-0 hover:bg-transparent w-full justify-start"
                                        >
                                            <Badge className={`${coldStatus.color} flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:opacity-80 transition-opacity w-full justify-center`}>
                                                {coldStatus.icon}
                                                {coldStatus.label}
                                            </Badge>
                                        </Button>
                                    ) : (
                                        <Badge className={`${coldStatus.color} flex items-center gap-1.5 px-3 py-1.5 w-full justify-center`}>
                                            {coldStatus.icon}
                                            {coldStatus.label}
                                        </Badge>
                                    )}
                                    {coldStatus.description && (
                                        <p className="text-xs text-muted-foreground mt-1 text-center">
                                            {coldStatus.description}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Reportes Individuales
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownloadReport(employee, 'hot')}
                                            disabled={!canGenerateHotReport(employee) || loadingReports[`${employee.participant_id}-hot`]}
                                            className="flex-1 text-xs"
                                        >
                                            <Download className="w-3 h-3 mr-1" />
                                            {loadingReports[`${employee.participant_id}-hot`] ? 'Gen...' : 'Empleado'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownloadReport(employee, 'cold')}
                                            disabled={!canGenerateColdReport(employee) || loadingReports[`${employee.participant_id}-cold`]}
                                            className="flex-1 text-xs"
                                        >
                                            <Download className="w-3 h-3 mr-1" />
                                            {loadingReports[`${employee.participant_id}-cold`] ? 'Gen...' : 'Evaluador'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog({ open, employee: null })
                }
                title="¿Eliminar participante?"
                description={`¿Estás seguro de que deseas eliminar a ${deleteDialog.employee?.nombre} de este curso? Esta acción eliminará todos sus cuestionarios asociados pero no eliminará al empleado del sistema. Esta acción no se puede deshacer.`}
                confirmText="Eliminar Participante"
                onConfirm={handleDeleteParticipant}
                variant="destructive"
            />
        </>
    );
}

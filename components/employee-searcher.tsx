"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CreateEmployeeModal } from '@/components/create-employee-modal';
import { supabase, Employee } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

interface EmployeeSearcherProps {
    courseId: string;
    onEmployeeAdded: () => void;
    existingEmployeeIds: string[];
}

export function EmployeeSearcher({ courseId, onEmployeeAdded, existingEmployeeIds }: EmployeeSearcherProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Employee[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAddingEmployee, setIsAddingEmployee] = useState<string | null>(null);
    const { toast } = useToast();
    const { plantId } = useAuth();

    useEffect(() => {
        const searchEmployees = async () => {
            if (searchTerm.trim().length < 2) {
                setSearchResults([]);
                setShowResults(false);
                return;
            }

            setIsSearching(true);
            setShowResults(true);

            try {
                const { data, error } = await supabase
                    .from('employees')
                    .select('*')
                    .or(`employee_number.ilike.%${searchTerm}%,nombre.ilike.%${searchTerm}%`)
                    .eq('plant_id', plantId)
                    .limit(10);

                if (error) throw error;

                const filtered = data?.filter(emp => !existingEmployeeIds.includes(emp.id)) || [];
                setSearchResults(filtered);
            } catch (error) {
                console.error('Error searching employees:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchEmployees, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, existingEmployeeIds]);

    const addEmployeeToCourse = async (employeeId: string) => {
        setIsAddingEmployee(employeeId);

        try {
            const { data: participantData, error: participantError } = await supabase
                .from('course_participants')
                .insert([{
                    course_id: courseId,
                    employee_id: employeeId,
                }])
                .select()
                .single();

            if (participantError) {
                if (participantError.code === '23505') {
                    toast({
                        title: 'Error',
                        description: 'Este empleado ya está inscrito en el curso',
                        variant: 'destructive',
                    });
                } else {
                    throw participantError;
                }
                return;
            }

            const { data: hotQuestionnaireData, error: hotError } = await supabase
                .rpc('create_hot_questionnaire_with_template', {
                    p_participant_id: participantData.id,
                    p_template_name: 'hot_standard'
                });

            if (hotError) {
                console.error('Error creating hot questionnaire:', hotError);
            }

            if (plantId) {
                const { error: dncError } = await supabase
                    .from('dnc_entries')
                    .insert([{
                        course_participant_id: participantData.id,
                        plant_id: plantId,
                    }]);
                if (dncError) {
                    console.error('Error creating DNC entry:', dncError);
                }
            }

            toast({
                title: 'Empleado agregado',
                description: 'El empleado fue inscrito exitosamente y sus cuestionarios fueron creados',
            });

            setSearchTerm('');
            setSearchResults([]);
            setShowResults(false);
            onEmployeeAdded();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo agregar el empleado al curso',
                variant: 'destructive',
            });
        } finally {
            setIsAddingEmployee(null);
        }
    };

    const handleEmployeeCreated = (employeeId: string) => {
        setIsCreateModalOpen(false);
        addEmployeeToCourse(employeeId);
    };

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Buscar por número de empleado o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
                    className="pl-10 pr-4 h-12 text-base"
                />
            </div>

            {showResults && (
                <Card className="absolute z-10 w-full mt-2 max-h-96 overflow-auto shadow-xl border-2">
                    {isSearching ? (
                        <div className="p-4 text-center text-muted-foreground">
                            Buscando...
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="divide-y">
                            {searchResults.map((employee) => (
                                <div
                                    key={employee.id}
                                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex-1" onClick={() => addEmployeeToCourse(employee.id)}>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-mono text-sm font-semibold text-blue-600">
                                                {employee.employee_number}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                {employee.nombre}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span>{employee.area}</span>
                                            <span>•</span>
                                            <span>{employee.puesto}</span>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => addEmployeeToCourse(employee.id)}
                                        disabled={isAddingEmployee === employee.id}
                                        className="bg-[#2166be] hover:bg-[#1a5299] text-white"
                                    >
                                        {isAddingEmployee === employee.id ? (
                                            'Agregando...'
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4 mr-1" />
                                                Agregar
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                <UserPlus className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-muted-foreground mb-4">
                                No se encontraron empleados con ese criterio
                            </p>
                            <Button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-[#2166be] hover:bg-[#1a5299] text-white"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Nuevo Empleado
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            <CreateEmployeeModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSuccess={handleEmployeeCreated}
                plantId={plantId || ''}
            />
        </div>
    );
}

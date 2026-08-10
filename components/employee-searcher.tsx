"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CreateEmployeeModal } from '@/components/create-employee-modal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Employee } from '@/types/database';

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
        const response = await fetch(
          `/employees/data?plant_id=${plantId}&search=${encodeURIComponent(searchTerm)}`,
          { credentials: 'include' }
        );

        if (!response.ok) throw new Error('Error buscando empleados');

        const data = await response.json();
        const employeesList: Employee[] = data.employees || [];
        const filtered = employeesList.filter(emp => !existingEmployeeIds.includes(emp.id));
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching employees:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchEmployees, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, existingEmployeeIds, plantId]);

  const addEmployeeToCourse = async (employeeId: string) => {
    setIsAddingEmployee(employeeId);

    try {
      const response = await fetch('/api/course-participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          employee_id: employeeId,
        }),
        credentials: 'include',
      });

      const json = await response.json();

      if (!response.ok) {
        if (json.code === '23505' || json.error?.includes('ya está inscrito')) {
          toast({
            title: 'Error',
            description: 'Este empleado ya está inscrito en el curso',
            variant: 'destructive',
          });
        } else {
          throw new Error(json.error || 'Error al inscribir empleado');
        }
        return;
      }

      toast({
        title: 'Empleado agregado',
        description: 'El empleado fue inscrito exitosamente y sus cuestionarios fueron creados',
      });

      setSearchTerm('');
      setSearchResults([]);
      setShowResults(false);
      onEmployeeAdded();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo agregar el empleado al curso',
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

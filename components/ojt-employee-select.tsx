"use client";

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase, Employee } from '@/lib/supabase';

interface OjtEmployeeSelectProps {
  value: string;
  placeholder?: string;
  onSelect: (employee: Employee | null) => void;
  employees: Employee[];
}

export function OjtEmployeeSelect({
  value,
  placeholder = 'Buscar empleado...',
  onSelect,
  employees,
}: OjtEmployeeSelectProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputValue.trim().length < 1) {
      setFiltered([]);
      return;
    }
    const lower = inputValue.toLowerCase();
    setFiltered(
      employees.filter(
        (e) =>
          e.nombre.toLowerCase().includes(lower) ||
          (e.employee_number && e.employee_number.toLowerCase().includes(lower))
      ).slice(0, 10)
    );
  }, [inputValue, employees]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (employee: Employee) => {
    setInputValue(employee.nombre);
    setShowDropdown(false);
    onSelect(employee);
  };

  const handleClear = () => {
    setInputValue('');
    onSelect(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowDropdown(true);
          if (!e.target.value) onSelect(null);
        }}
        onFocus={() => inputValue.length >= 1 && setShowDropdown(true)}
        className="h-9 text-sm"
      />
      {showDropdown && filtered.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto border shadow-md">
          <div className="divide-y">
            {filtered.map((emp) => (
              <div
                key={emp.id}
                className="px-3 py-2 hover:bg-muted cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(emp);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary font-semibold">
                    {emp.employee_number}
                  </span>
                  <span className="text-sm font-medium text-foreground">{emp.nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{emp.puesto}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

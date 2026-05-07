"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { Departamento } from '@/lib/supabase';

interface DepartmentComboboxProps {
    departamentos: Departamento[];
    value: string | null;
    onChange: (id: string | null) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function DepartmentCombobox({
    departamentos,
    value,
    onChange,
    disabled = false,
    placeholder = 'Seleccionar departamento...',
    className = '',
}: DepartmentComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = value ? departamentos.find(d => d.id === value) : null;

    const filtered = departamentos.filter(d =>
        d.nombre_completo.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    const handleSelect = (dept: Departamento) => {
        onChange(dept.id);
        setOpen(false);
        setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setOpen(false);
        setSearch('');
    };

    const handleToggle = () => {
        if (disabled) return;
        setOpen(prev => !prev);
        if (open) setSearch('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between gap-2
                    h-9 rounded-md border border-input bg-background
                    px-3 py-2 text-sm text-left
                    ring-offset-background transition-colors
                    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                    disabled:cursor-not-allowed disabled:opacity-50
                    hover:border-[#2166be]
                    ${open ? 'border-[#2166be] ring-2 ring-[#2166be]/20' : ''}
                `}
            >
                <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                    {selected ? selected.nombre_completo : placeholder}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {selected && !disabled && (
                        <span
                            role="button"
                            onClick={handleClear}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar departamento..."
                            className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 outline-none focus:border-[#2166be] focus:ring-1 focus:ring-[#2166be]/20"
                            onKeyDown={e => {
                                if (e.key === 'Escape') {
                                    setOpen(false);
                                    setSearch('');
                                }
                                if (e.key === 'Enter' && filtered.length === 1) {
                                    handleSelect(filtered[0]);
                                }
                            }}
                        />
                    </div>

                    <ul className="max-h-56 overflow-y-auto py-1">
                        <li>
                            <button
                                type="button"
                                onClick={handleClear}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                                    ${!value ? 'bg-blue-50 text-[#2166be]' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}
                                `}
                            >
                                <X className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="italic">Sin departamento</span>
                            </button>
                        </li>

                        {filtered.length === 0 ? (
                            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                                No se encontraron departamentos
                            </li>
                        ) : (
                            filtered.map(dept => (
                                <li key={dept.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(dept)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                                            ${value === dept.id ? 'bg-blue-50 text-[#2166be] font-medium' : 'hover:bg-muted/60'}
                                        `}
                                    >
                                        <Check className={`w-3.5 h-3.5 flex-shrink-0 ${value === dept.id ? 'opacity-100' : 'opacity-0'}`} />
                                        <span>{dept.nombre_completo}</span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

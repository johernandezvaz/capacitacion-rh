"use client";
import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { COLORES_DETECCION } from '@/lib/detecciones-utils';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    deteccionId: string;
    deteccionNombre: string;
    empleadoId: string;
    empleadoNombre: string;
    currentColor: string;
    onSaved: (color: string, status: string) => void;
}

export function EstadoIndividualModal({
    open, onOpenChange,
    deteccionId, deteccionNombre,
    empleadoId, empleadoNombre,
    currentColor, onSaved,
}: Props) {
    const { toast } = useToast();
    const [color, setColor] = useState(currentColor);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) setColor(currentColor);
    }, [open, currentColor]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const entry = COLORES_DETECCION.find(c => c.hex === color);
            const status = entry?.status ?? null;

            const { error } = await supabase
                .from('deteccion_empleados')
                .update({ color, status })
                .eq('deteccion_id', deteccionId)
                .eq('employee_id', empleadoId);

            if (error) throw error;
            toast({ title: 'Éxito', description: 'Estado actualizado' });
            onSaved(color, status ?? '');
            onOpenChange(false);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Estado de {empleadoNombre}</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground truncate">
                        {deteccionNombre}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-4 gap-2 py-2">
                    {COLORES_DETECCION.map(c => {
                        const active = color === c.hex;
                        return (
                            <button
                                key={c.hex}
                                type="button"
                                onClick={() => setColor(c.hex)}
                                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${active ? 'border-gray-800 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-400'
                                    }`}
                            >
                                <div className="relative w-8 h-8">
                                    <span className="w-8 h-8 rounded-full block" style={{ background: c.hex }} />
                                    {active && (
                                        <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">✓</span>
                                    )}
                                </div>
                                <span className="text-[10px] text-center leading-tight text-muted-foreground">{c.label}</span>
                            </button>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#2166be] hover:bg-[#1a5299] text-white"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

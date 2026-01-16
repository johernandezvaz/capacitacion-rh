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
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface CreateYearModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateYearModal({
    open,
    onOpenChange,
    onSuccess,
}: CreateYearModalProps) {
    const [year, setYear] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const yearNumber = parseInt(year);
        if (!yearNumber || yearNumber < 2000 || yearNumber > 2100) {
            setError('Por favor ingresa un año válido');
            return;
        }

        setIsLoading(true);

        try {
            const { error: insertError } = await supabase
                .from('training_years')
                .insert([{ year: yearNumber }]);

            if (insertError) {
                if (insertError.code === '23505') {
                    setError('Este año ya existe');
                } else {
                    throw insertError;
                }
                return;
            }

            setYear('');
            onSuccess();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo crear el año',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setYear('');
        setError('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Crear Año de Capacitación</DialogTitle>
                    <DialogDescription>
                        Ingresa el año para comenzar a gestionar capacitaciones
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="year">Año</Label>
                            <Input
                                id="year"
                                type="number"
                                placeholder="2025"
                                value={year}
                                onChange={(e) => {
                                    setYear(e.target.value);
                                    setError('');
                                }}
                                min="2000"
                                max="2100"
                                required
                            />
                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
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
                            {isLoading ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

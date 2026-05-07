'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export type TrainingYearOption = { id: string; year: number };

export function useTrainingYears() {
    const { plantId } = useAuth();
    const [years, setYears] = useState<TrainingYearOption[]>([]);
    const [selectedYearId, setSelectedYearId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!plantId) return;
        fetchYears();
    }, [plantId]);

    const fetchYears = async () => {
        setIsLoading(true);
        const { data } = await supabase
            .from('training_years')
            .select('id, year')
            .eq('plant_id', plantId)
            .order('year', { ascending: false });

        const list: TrainingYearOption[] = data || [];
        setYears(list);
        if (list.length > 0) setSelectedYearId(list[0].id);
        setIsLoading(false);
    };

    const selectedYear = years.find(y => y.id === selectedYearId) ?? null;

    return { years, selectedYearId, setSelectedYearId, selectedYear, isLoadingYears: isLoading };
}

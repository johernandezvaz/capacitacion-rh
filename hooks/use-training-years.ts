'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { TrainingYear } from '@/types/database';

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
    try {
      const res = await fetch('/api/training-years', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const list: TrainingYearOption[] = (json.data || []).map((y: TrainingYear) => ({
          id: y.id,
          year: y.year,
        }));
        setYears(list);
        if (list.length > 0 && !selectedYearId) {
          setSelectedYearId(list[0].id);
        }
      }
    } catch (err) {
      console.error('[useTrainingYears] Error fetching years:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedYear = years.find((y) => y.id === selectedYearId) ?? null;

  return { years, selectedYearId, setSelectedYearId, selectedYear, isLoadingYears: isLoading, refetch: fetchYears };
}

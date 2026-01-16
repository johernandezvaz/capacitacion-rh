"use client";

import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingYear } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface YearCardProps {
    year: TrainingYear;
}

export function YearCard({ year }: YearCardProps) {
    const router = useRouter();
    const [courseCount, setCourseCount] = useState<number>(0);

    useEffect(() => {
        const fetchCourseCount = async () => {
            const { count } = await supabase
                .from('courses')
                .select('*', { count: 'exact', head: true })
                .eq('year_id', year.id);

            setCourseCount(count || 0);
        };

        fetchCourseCount();
    }, [year.id]);

    return (
        <Card
            onClick={() => router.push(`/year/${year.id}`)}
            className="p-6 cursor-pointer transition-all hover:border-[#2166be] hover:shadow-md group"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#2166be]/10 flex items-center justify-center group-hover:bg-[#2166be]/20 transition-colors">
                        <Calendar className="w-6 h-6 text-[#2166be]" />
                    </div>
                </div>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    {courseCount} {courseCount === 1 ? 'curso' : 'cursos'}
                </Badge>
            </div>

            <h3 className="text-3xl font-bold text-foreground mb-1">
                {year.year}
            </h3>
            <p className="text-sm text-muted-foreground">
                Año de capacitación
            </p>
        </Card>
    );
}

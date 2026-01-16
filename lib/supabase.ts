import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type TrainingYear = {
    id: string;
    year: number;
    created_at: string;
}

export type Course = {
    id: string;
    year_id: string;
    name: string;
    date: string;
    duration_hours: number;
    status: 'draft' | 'active' | 'closed';
    created_at: string;
}


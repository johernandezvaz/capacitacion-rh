import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type TrainingYear = {
    id: string;
    year: number;
    created_at: string;
};

export type Course = {
    id: string;
    year_id: string;
    name: string;
    date: string;
    duration_hours: number;
    status: 'draft' | 'active' | 'closed';
    created_at: string;
};

export type Employee = {
    id: string;
    employee_number: string;
    first_name: string;
    last_name: string;
    email?: string;
    department?: string;
    position?: string;
    created_at: string;
};

export type CourseParticipant = {
    id: string;
    course_id: string;
    employee_id: string;
    enrolled_at: string;
    has_completed_hot: boolean;
    has_completed_cold: boolean;
};

export type HotQuestionnaire = {
    id: string;
    participant_id: string;
    completed_at?: string;
    is_locked: boolean;
    average_score?: number;
    created_at: string;
};

export type HotSectionScore = {
    id: string;
    questionnaire_id: string;
    section_number: number;
    question_text: string;
    score: number;
};

export type HotSectionYesNo = {
    id: string;
    questionnaire_id: string;
    section_number: number;
    question_text: string;
    answer: boolean;
};

export type ColdQuestionnaire = {
    id: string;
    participant_id: string;
    hot_questionnaire_id: string;
    evaluator_name?: string;
    evaluation_date?: string;
    signature_employee_name?: string;
    signature_date?: string;
    is_completed: boolean;
    is_locked: boolean;
    created_at: string;
};

export type ColdQuestionnaireSection = {
    id: string;
    cold_questionnaire_id: string;
    section_number: number;
    question_text: string;
    answer_text?: string;
    created_at: string;
};

export type QuestionnaireTemplate = {
    id: string;
    template_name: string;
    section_number: number;
    question_text: string;
    answer_type: 'score' | 'yesno' | 'text';
    is_active: boolean;
    created_at: string;
};

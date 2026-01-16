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
  nombre: string;
  area: string;
  puesto: string;
  evaluador: string;
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

export type Questionnaire = {
  id: string;
  course_participant_id: string;
  course_id: string;
  employee_id: string;
  type: 'hot' | 'cold';
  status: 'pending' | 'completed' | 'locked';
  submitted_at: string | null;
  available_from: string;
  average_score: number | null;
  additional_comments: string | null;
  created_at: string;
};

export type HotQuestionnaire = Questionnaire;
export type ColdQuestionnaire = Questionnaire;

export type EmployeeWithQuestionnaires = Employee & {
  participant_id: string;
  hot_questionnaire: Questionnaire | null;
  cold_questionnaire: Questionnaire | null;
};

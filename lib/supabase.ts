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
  start_date?: string | null;
  end_date?: string | null;
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
  course_id?: string;
  hot_questionnaire: (Questionnaire & {
    evaluator_signed_at?: string | null;
    employee_signed_at?: string | null;
  }) | null;
  cold_questionnaire: (Questionnaire & {
    evaluator_signed_at?: string | null;
    employee_signed_at?: string | null;
  }) | null;
};

export type OjtRecord = {
  id: string;
  titulo: string | null;
  employee_id: string | null;
  puesto: string | null;
  nombre: string | null;
  fecha_inicio: string | null;
  fecha_termino: string | null;
  piloto_proceso: string | null;
  periodo_entrenamiento: string | null;
  jefe_directo_id: string | null;
  integrante_brigada_id: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'locked';
  created_at: string;
  updated_at: string;
  // Joined fields
  empleado_nombre?: string | null;
  empleado_puesto?: string | null;
  jefe_directo_nombre?: string | null;
  integrante_brigada_nombre?: string | null;
};

export type OjtEntry = {
  id: string;
  section_id: string;
  orden: number;
  conocimiento_requerido: string | null;
  habilidades: string | null;
  fuentes_informacion: string | null;
  procedimientos_internos: string | null;
  metodo_entrenamiento: string | null;
  duracion: string | null;
  fecha_planeada_terminacion: string | null;
  fecha_real_inicio: string | null;
  fecha_real_termino: string | null;
  responsable_entrenamiento: string | null;
  firma_empleado: string | null;
  firma_empleado_at: string | null;
  comentarios: string | null;
  created_at: string;
  updated_at: string;
};

export type OjtSection = {
  id: string;
  record_id: string;
  tipo: 'conocimientos_generales' | 'actividad';
  nombre: string;
  orden: number;
};

export type OjtSectionWithEntries = OjtSection & {
  entries: OjtEntry[];
};

export type OjtSignature = {
  id: string;
  record_id: string;
  signer_type: 'empleado' | 'jefe_directo' | 'recursos_humanos';
  signer_name: string | null;
  signed_at: string | null;
  created_at: string;
};

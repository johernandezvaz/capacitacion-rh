import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authLog } from './auth-debug';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('SUPABASE CLIENT CREATED');

const globalForSupabase = globalThis as unknown as {
  supabase: SupabaseClient | undefined;
};

const isPublicPath = () => {
  if (typeof window === 'undefined') return true;
  const p = window.location.pathname;
  return p.startsWith('/public') || p.startsWith('/login');
};

const shortUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ? '?…' : '');
  } catch {
    return url;
  }
};

const customFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL ? input.toString()
      : input instanceof Request ? input.url
        : '';

  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const start = performance.now();

  let response: Response;

  try {
    response = await fetch(input as RequestInfo, init);
  } catch (e) {
    authLog('fetch', `NETWORK ERROR ${method} ${url}`, { error: String(e) });
    throw e;
  }

  const isAuth = url.includes('/auth/v1/');

  if (response.status >= 400) {
    authLog('fetch', `${response.status} ${method} ${url}`, { isAuth });
  }

  if (response.status === 401) {
    authLog('warn', '401 detectado (ignorado)', { url });
  }

  return response;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      fetch: customFetch,
    },
  });

if (typeof window !== 'undefined') {
  globalForSupabase.supabase = supabase;
}

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
  plant_id?: string | null;
  inst_interno?: boolean;
  inst_externo?: boolean;
  proveedor_sugerido?: string | null;
  costo?: number | null;
  desarrollo_personal?: boolean;
  habilidades_blandas?: boolean;
  prevencion_riesgos?: boolean;
  habilidades_tecnicas?: boolean;
  fecha_programada?: string | null;
  fecha_real?: string | null;
  comentario_dnc?: string | null;
};

export type Employee = {
  id: string;
  employee_number: string;
  nombre: string;
  area: string;
  puesto: string;
  evaluador: string;
  created_at: string;
  es_baja: boolean;
  fecha_baja: string | null;
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
  puesto: string | null;
  periodo_entrenamiento: string | null;
  jefe_directo_id: string | null;
  es_piloto_proceso: boolean;
  piloto_proceso_codigo: string | null;
  es_integrante_brigada: boolean;
  is_template: boolean;
  status: 'draft' | 'in_progress' | 'completed' | 'locked';
  created_at: string;
  updated_at: string;
  jefe_directo_nombre?: string | null;
};

export type OjtSection = {
  id: string;
  record_id: string;
  tipo: 'conocimientos_generales' | 'actividad';
  nombre: string;
  orden: number;
  created_at: string;
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
  puesto_responsable: string | null;
  created_at: string;
  updated_at: string;
};

export type OjtSectionWithEntries = OjtSection & {
  entries: OjtEntry[];
};

export type OjtInstance = {
  id: string;
  template_id: string;
  employee_id: string | null;
  nombre: string | null;
  fecha_inicio: string | null;
  fecha_termino: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'locked';
  average_efectividad: number | null;
  created_at: string;
  updated_at: string;
  empleado_nombre?: string | null;
  empleado_puesto?: string | null;
  es_baja: boolean;
};

export type OjtInstanceEntry = {
  id: string;
  instance_id: string;
  entry_id: string;
  efectividad: number | null;
  responsable_nombre: string | null;
  responsable_firma_url: string | null;
  fecha_planeada_terminacion: string | null;
  fecha_real_inicio: string | null;
  fecha_real_termino: string | null;
  comentarios: string | null;
  created_at: string;
  updated_at: string;
};

export type OjtInstanceSignature = {
  id: string;
  instance_id: string;
  signer_type: 'empleado' | 'jefe_directo' | 'recursos_humanos';
  signer_name: string | null;
  signed_at: string | null;
  firma_url: string | null;
  created_at: string;
};

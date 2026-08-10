export interface TrainingYear {
  id: string;
  year: number;
  plant_id: string;
  course_count?: number;
  created_at?: string;
}

export interface Course {
  id: string;
  year_id: string;
  name: string;
  date: string;
  start_date?: string | null;
  duration_hours: number;
  status: 'programado' | 'en_proceso' | 'completado' | 'cancelado';
  plant_id: string;
  end_date?: string | null;
  inst_interno?: string | null;
  inst_externo?: string | null;
  proveedor_sugerido?: string | null;
  costo?: number | null;
  fecha_programada?: string | null;
  fecha_real?: string | null;
  desarrollo_personal?: boolean;
  habilidades_blandas?: boolean;
  prevencion_riesgos?: boolean;
  habilidades_tecnicas?: boolean;
  comentario_dnc?: string | null;
  deteccion_id?: string | null;
  created_at?: string;
  training_year?: TrainingYear;
}

export interface Employee {
  id: string;
  employee_number: string;
  nombre: string;
  area: string;
  puesto: string;
  evaluador?: string | null;
  es_baja: boolean;
  fecha_baja?: string | null;
  plant_id: string;
  created_at?: string;
}

export interface CourseParticipant {
  id: string;
  course_id: string;
  employee_id: string;
  created_at?: string;
  employee?: Employee;
}

export interface Questionnaire {
  id: string;
  course_participant_id: string;
  course_id: string;
  employee_id: string;
  type: 'hot' | 'cold';
  status: 'pendiente' | 'completado' | 'en_progreso';
  submitted_at?: string | null;
  available_from?: string | null;
  average_score?: number | null;
  additional_comments?: string | null;
  observation_1?: string | null;
  created_at?: string;
}

export interface EmployeeWithQuestionnaires extends Employee {
  participant_id?: string;
  course_id?: string;
  hot_questionnaire?: Questionnaire | null;
  cold_questionnaire?: Questionnaire | null;
  questionnaires?: Questionnaire[];
  course_participants?: { course_id: string }[];
}

export interface Deteccion {
  id: string;
  plant_id: string;
  year_id: string;
  nombre: string;
  costo_estimado?: number | null;
  fecha_inicio_estimada?: string | null;
  fecha_fin_estimada?: string | null;
  duracion_estimada_horas?: number | null;
  es_dnc?: boolean;
  status?: string;
  created_at?: string;
  empleados?: Employee[];
}

export interface OjtRecord {
  id: string;
  plant_id?: string | null;
  titulo?: string | null;
  puesto?: string | null;
  periodo_entrenamiento?: string | null;
  es_piloto_proceso?: boolean;
  piloto_proceso_codigo?: string | null;
  es_integrante_brigada?: boolean;
  jefe_directo_id?: string | null;
  is_template?: boolean;
  created_at?: string;
  updated_at?: string;
  jefe_directo?: Employee | null;
}

export interface OjtSection {
  id: string;
  record_id: string;
  tipo?: string;
  nombre?: string;
  orden: number;
  created_at?: string;
  updated_at?: string;
  entries?: OjtEntry[];
}

export interface OjtEntry {
  id: string;
  section_id: string;
  orden: number;
  conocimiento_requerido?: string | null;
  habilidades?: string | null;
  fuentes_informacion?: string | null;
  procedimientos_internos?: string | null;
  metodo_entrenamiento?: string | null;
  duracion?: string | null;
  puesto_responsable?: string | null;
  instruccion?: string | null;
  criterio_evaluacion?: string | null;
  metodo_evaluacion?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OjtSectionWithEntries extends OjtSection {
  entries: OjtEntry[];
}

export interface OjtInstance {
  id: string;
  template_id: string;
  employee_id: string;
  jefe_directo_id?: string | null;
  nombre?: string | null;
  fecha_inicio?: string | null;
  fecha_termino?: string | null;
  average_efectividad?: number | null;
  public_token?: string | null;
  status?: string;
  es_baja?: boolean;
  created_at?: string;
  employee?: Employee;
  template?: OjtRecord;
  empleado_nombre?: string;
  empleado_puesto?: string;
}

export interface OjtInstanceEntry {
  id: string;
  instance_id: string;
  entry_id: string;
  cumple?: boolean | null;
  observaciones?: string | null;
  fecha_evaluacion?: string | null;
  fecha_planeada_terminacion?: string | null;
  fecha_real_inicio?: string | null;
  fecha_real_termino?: string | null;
  efectividad?: number | null;
  responsable_nombre?: string | null;
  responsable_firma_url?: string | null;
  empleado_firma_url?: string | null;
  comentarios?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OjtInstanceSignature {
  id: string;
  instance_id: string;
  signer_type: string;
  signer_name?: string | null;
  firma_url?: string | null;
  signed_at?: string | null;
  created_at?: string;
}

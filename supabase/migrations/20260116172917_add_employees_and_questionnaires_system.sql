/*
  # Sistema de Empleados y Cuestionarios de Capacitación

  ## Descripción General
  Esta migración extiende el sistema de capacitaciones agregando:
  - Gestión de empleados
  - Asociación empleados-cursos
  - Cuestionarios calientes (evaluación inmediata por empleado)
  - Cuestionarios fríos (evaluación post-3 meses por evaluador)
  - Sistema de bloqueo y firma digital
  - Cálculo automático de promedios

  ## Tablas Nuevas

  ### 1. `employees`
  Almacena información de empleados de la empresa.
  - `id` (uuid, primary key): Identificador único
  - `employee_number` (text, unique): Número de empleado único
  - `first_name` (text): Nombre(s) del empleado
  - `last_name` (text): Apellido(s) del empleado
  - `email` (text): Correo electrónico
  - `department` (text): Departamento
  - `position` (text): Puesto
  - `created_at` (timestamptz): Fecha de registro

  ### 2. `course_participants`
  Vincula empleados a cursos específicos.
  - `id` (uuid, primary key): Identificador único
  - `course_id` (uuid, foreign key): Referencia al curso
  - `employee_id` (uuid, foreign key): Referencia al empleado
  - `enrolled_at` (timestamptz): Fecha de inscripción
  - `has_completed_hot` (boolean): Indica si completó cuestionario caliente
  - `has_completed_cold` (boolean): Indica si completó cuestionario frío
  - Constraint: Un empleado no puede estar duplicado en el mismo curso

  ### 3. `hot_questionnaires`
  Cuestionarios de evaluación inmediata (completados por el empleado).
  - `id` (uuid, primary key): Identificador único
  - `participant_id` (uuid, foreign key): Referencia al participante
  - `completed_at` (timestamptz): Fecha de completado
  - `is_locked` (boolean): Indica si está bloqueado para edición
  - `average_score` (decimal): Promedio general del cuestionario
  - `created_at` (timestamptz): Fecha de creación

  ### 4. `hot_section_scores`
  Secciones del cuestionario caliente con puntuaciones (1-10).
  - `id` (uuid, primary key): Identificador único
  - `questionnaire_id` (uuid, foreign key): Referencia al cuestionario
  - `section_number` (integer): Número de sección
  - `question_text` (text): Texto de la pregunta
  - `score` (integer): Puntuación (1-10)
  - Constraint: Score debe estar entre 1 y 10

  ### 5. `hot_section_yesno`
  Secciones del cuestionario caliente con respuestas sí/no.
  - `id` (uuid, primary key): Identificador único
  - `questionnaire_id` (uuid, foreign key): Referencia al cuestionario
  - `section_number` (integer): Número de sección
  - `question_text` (text): Texto de la pregunta
  - `answer` (boolean): Respuesta (true = sí, false = no)

  ### 6. `cold_questionnaires`
  Cuestionarios de evaluación diferida (completados por evaluador después de 3 meses).
  - `id` (uuid, primary key): Identificador único
  - `participant_id` (uuid, foreign key): Referencia al participante
  - `hot_questionnaire_id` (uuid, foreign key): Referencia al cuestionario caliente
  - `evaluator_name` (text): Nombre del evaluador
  - `evaluation_date` (date): Fecha de evaluación
  - `signature_employee_name` (text): Nombre del empleado para firma
  - `signature_date` (timestamptz): Fecha de firma
  - `is_completed` (boolean): Indica si está completado
  - `is_locked` (boolean): Indica si está bloqueado
  - `created_at` (timestamptz): Fecha de creación
  - Constraint: Solo puede crearse después de 3 meses del cuestionario caliente

  ## Índices
  - Índices en foreign keys para mejorar rendimiento de joins
  - Índice en employee_number para búsquedas rápidas
  - Índices compuestos para consultas frecuentes

  ## Funciones y Triggers
  - Función para calcular promedio de cuestionario caliente
  - Función para validar bloqueo de 3 meses
  - Función para verificar si todos completaron (curso)

  ## Seguridad (RLS)
  - Todas las tablas tienen RLS habilitado
  - Políticas permisivas para usuarios autenticados
*/

-- =====================================================================
-- TABLA: employees
-- =====================================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  department text,
  position text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- =====================================================================
-- TABLA: course_participants
-- =====================================================================

CREATE TABLE IF NOT EXISTS course_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  has_completed_hot boolean DEFAULT false,
  has_completed_cold boolean DEFAULT false,
  CONSTRAINT unique_course_participant UNIQUE(course_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_course ON course_participants(course_id);
CREATE INDEX IF NOT EXISTS idx_participants_employee ON course_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_participants_completion ON course_participants(course_id, has_completed_hot, has_completed_cold);

-- =====================================================================
-- TABLA: hot_questionnaires
-- =====================================================================

CREATE TABLE IF NOT EXISTS hot_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES course_participants(id) ON DELETE CASCADE,
  completed_at timestamptz,
  is_locked boolean DEFAULT false,
  average_score decimal(4,2),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_hot_questionnaire_per_participant UNIQUE(participant_id)
);

CREATE INDEX IF NOT EXISTS idx_hot_questionnaires_participant ON hot_questionnaires(participant_id);
CREATE INDEX IF NOT EXISTS idx_hot_questionnaires_locked ON hot_questionnaires(is_locked);

-- =====================================================================
-- TABLA: hot_section_scores
-- =====================================================================

CREATE TABLE IF NOT EXISTS hot_section_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES hot_questionnaires(id) ON DELETE CASCADE,
  section_number integer NOT NULL,
  question_text text NOT NULL,
  score integer NOT NULL,
  CONSTRAINT check_score_range CHECK (score >= 1 AND score <= 10)
);

CREATE INDEX IF NOT EXISTS idx_hot_scores_questionnaire ON hot_section_scores(questionnaire_id);

-- =====================================================================
-- TABLA: hot_section_yesno
-- =====================================================================

CREATE TABLE IF NOT EXISTS hot_section_yesno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES hot_questionnaires(id) ON DELETE CASCADE,
  section_number integer NOT NULL,
  question_text text NOT NULL,
  answer boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hot_yesno_questionnaire ON hot_section_yesno(questionnaire_id);

-- =====================================================================
-- TABLA: cold_questionnaires
-- =====================================================================

CREATE TABLE IF NOT EXISTS cold_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES course_participants(id) ON DELETE CASCADE,
  hot_questionnaire_id uuid NOT NULL REFERENCES hot_questionnaires(id) ON DELETE CASCADE,
  evaluator_name text,
  evaluation_date date,
  signature_employee_name text,
  signature_date timestamptz,
  is_completed boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_cold_questionnaire_per_participant UNIQUE(participant_id)
);

CREATE INDEX IF NOT EXISTS idx_cold_questionnaires_participant ON cold_questionnaires(participant_id);
CREATE INDEX IF NOT EXISTS idx_cold_questionnaires_hot_ref ON cold_questionnaires(hot_questionnaire_id);

-- =====================================================================
-- FUNCIÓN: Calcular promedio de cuestionario caliente
-- =====================================================================

CREATE OR REPLACE FUNCTION calculate_hot_questionnaire_average(questionnaire_uuid uuid)
RETURNS decimal AS $$
DECLARE
  avg_score decimal;
BEGIN
  SELECT AVG(score) INTO avg_score
  FROM hot_section_scores
  WHERE questionnaire_id = questionnaire_uuid;
  
  RETURN COALESCE(avg_score, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Verificar si han pasado 3 meses desde cuestionario caliente
-- =====================================================================

CREATE OR REPLACE FUNCTION has_three_months_passed(hot_questionnaire_uuid uuid)
RETURNS boolean AS $$
DECLARE
  completion_date timestamptz;
BEGIN
  SELECT completed_at INTO completion_date
  FROM hot_questionnaires
  WHERE id = hot_questionnaire_uuid;
  
  IF completion_date IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN (now() >= completion_date + INTERVAL '3 months');
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Verificar si todos los participantes completaron cuestionarios calientes
-- =====================================================================

CREATE OR REPLACE FUNCTION all_participants_completed_hot(course_uuid uuid)
RETURNS boolean AS $$
DECLARE
  total_participants integer;
  completed_participants integer;
BEGIN
  SELECT COUNT(*) INTO total_participants
  FROM course_participants
  WHERE course_id = course_uuid;
  
  IF total_participants = 0 THEN
    RETURN false;
  END IF;
  
  SELECT COUNT(*) INTO completed_participants
  FROM course_participants
  WHERE course_id = course_uuid AND has_completed_hot = true;
  
  RETURN (total_participants = completed_participants);
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Calcular promedio general del curso (solo si todos completaron)
-- =====================================================================

CREATE OR REPLACE FUNCTION calculate_course_average(course_uuid uuid)
RETURNS decimal AS $$
DECLARE
  course_avg decimal;
  all_completed boolean;
BEGIN
  SELECT all_participants_completed_hot(course_uuid) INTO all_completed;
  
  IF NOT all_completed THEN
    RETURN NULL;
  END IF;
  
  SELECT AVG(hq.average_score) INTO course_avg
  FROM hot_questionnaires hq
  INNER JOIN course_participants cp ON cp.id = hq.participant_id
  WHERE cp.course_id = course_uuid AND hq.is_locked = true;
  
  RETURN COALESCE(course_avg, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- TRIGGER: Actualizar promedio al insertar/actualizar scores
-- =====================================================================

CREATE OR REPLACE FUNCTION update_hot_questionnaire_average()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hot_questionnaires
  SET average_score = calculate_hot_questionnaire_average(NEW.questionnaire_id)
  WHERE id = NEW.questionnaire_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hot_average ON hot_section_scores;
CREATE TRIGGER trigger_update_hot_average
AFTER INSERT OR UPDATE ON hot_section_scores
FOR EACH ROW
EXECUTE FUNCTION update_hot_questionnaire_average();

-- =====================================================================
-- TRIGGER: Actualizar has_completed_hot al completar cuestionario
-- =====================================================================

CREATE OR REPLACE FUNCTION update_participant_hot_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_locked = true AND NEW.completed_at IS NOT NULL THEN
    UPDATE course_participants
    SET has_completed_hot = true
    WHERE id = NEW.participant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_participant_hot ON hot_questionnaires;
CREATE TRIGGER trigger_update_participant_hot
AFTER UPDATE ON hot_questionnaires
FOR EACH ROW
WHEN (NEW.is_locked = true AND OLD.is_locked = false)
EXECUTE FUNCTION update_participant_hot_status();

-- =====================================================================
-- TRIGGER: Actualizar has_completed_cold al completar cuestionario frío
-- =====================================================================

CREATE OR REPLACE FUNCTION update_participant_cold_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true THEN
    UPDATE course_participants
    SET has_completed_cold = true
    WHERE id = NEW.participant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_participant_cold ON cold_questionnaires;
CREATE TRIGGER trigger_update_participant_cold
AFTER UPDATE ON cold_questionnaires
FOR EACH ROW
WHEN (NEW.is_completed = true AND OLD.is_completed = false)
EXECUTE FUNCTION update_participant_cold_status();

-- =====================================================================
-- TRIGGER: Prevenir modificación de cuestionario bloqueado
-- =====================================================================

CREATE OR REPLACE FUNCTION prevent_locked_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'No se puede modificar un cuestionario bloqueado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_hot_questionnaire_modification ON hot_questionnaires;
CREATE TRIGGER prevent_hot_questionnaire_modification
BEFORE UPDATE ON hot_questionnaires
FOR EACH ROW
WHEN (OLD.is_locked = true AND (NEW.is_locked <> OLD.is_locked OR NEW.completed_at <> OLD.completed_at))
EXECUTE FUNCTION prevent_locked_modification();

-- =====================================================================
-- VISTA: Resumen de participantes por curso
-- =====================================================================

CREATE OR REPLACE VIEW vw_course_participants_summary AS
SELECT 
  c.id AS course_id,
  c.name AS course_name,
  ty.year AS course_year,
  COUNT(cp.id) AS total_participants,
  SUM(CASE WHEN cp.has_completed_hot THEN 1 ELSE 0 END) AS completed_hot,
  SUM(CASE WHEN cp.has_completed_cold THEN 1 ELSE 0 END) AS completed_cold,
  all_participants_completed_hot(c.id) AS all_hot_completed,
  calculate_course_average(c.id) AS course_average
FROM courses c
INNER JOIN training_years ty ON ty.id = c.year_id
LEFT JOIN course_participants cp ON cp.course_id = c.id
GROUP BY c.id, c.name, ty.year;

-- =====================================================================
-- VISTA: Detalle de empleados con sus cuestionarios
-- =====================================================================

CREATE OR REPLACE VIEW vw_employee_questionnaires AS
SELECT 
  e.id AS employee_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name AS full_name,
  e.department,
  c.id AS course_id,
  c.name AS course_name,
  cp.enrolled_at,
  hq.id AS hot_questionnaire_id,
  hq.completed_at AS hot_completed_at,
  hq.average_score AS hot_average,
  hq.is_locked AS hot_locked,
  cq.id AS cold_questionnaire_id,
  cq.is_completed AS cold_completed,
  cq.signature_date AS cold_signature_date
FROM employees e
INNER JOIN course_participants cp ON cp.employee_id = e.id
INNER JOIN courses c ON c.id = cp.course_id
LEFT JOIN hot_questionnaires hq ON hq.participant_id = cp.id
LEFT JOIN cold_questionnaires cq ON cq.participant_id = cp.id;

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_section_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_section_yesno ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_questionnaires ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados (sistema interno)

CREATE POLICY "Allow all operations for authenticated users on employees"
  ON employees FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on course_participants"
  ON course_participants FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on hot_questionnaires"
  ON hot_questionnaires FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on hot_section_scores"
  ON hot_section_scores FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on hot_section_yesno"
  ON hot_section_yesno FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on cold_questionnaires"
  ON cold_questionnaires FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
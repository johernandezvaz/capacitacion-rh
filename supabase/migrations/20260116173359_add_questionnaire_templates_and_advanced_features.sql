/*
  # Plantillas de Cuestionarios y Funciones Avanzadas

  ## Descripción
  Esta migración agrega funcionalidad avanzada al sistema de cuestionarios:
  - Plantillas de preguntas reutilizables
  - Secciones de respuestas para cuestionarios fríos
  - Funciones para crear cuestionarios con plantillas
  - Funciones para validación y bloqueo seguro
  - Función para reportes de empleados

  ## Tablas Nuevas

  ### `questionnaire_templates`
  Almacena plantillas de preguntas que pueden reutilizarse en múltiples cuestionarios.
  - `id` (uuid, primary key)
  - `template_name` (text): Nombre de la plantilla (ej: hot_standard, cold_standard)
  - `section_number` (integer): Número de sección
  - `question_text` (text): Texto de la pregunta
  - `answer_type` (text): Tipo de respuesta (score, yesno, text)
  - `is_active` (boolean): Indica si la pregunta está activa
  - `created_at` (timestamptz)

  ### `cold_questionnaire_sections`
  Almacena las respuestas de texto libre del cuestionario frío.
  - `id` (uuid, primary key)
  - `cold_questionnaire_id` (uuid, foreign key)
  - `section_number` (integer)
  - `question_text` (text)
  - `answer_text` (text)
  - `created_at` (timestamptz)

  ## Funciones Nuevas
  - Crear cuestionarios con plantillas automáticamente
  - Validar cuestionarios antes de bloquear
  - Completar cuestionarios fríos con firma
  - Reportes de empleados
*/

-- =====================================================================
-- TABLA: questionnaire_templates
-- =====================================================================

CREATE TABLE IF NOT EXISTS questionnaire_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  section_number integer NOT NULL,
  question_text text NOT NULL,
  answer_type text NOT NULL CHECK (answer_type IN ('score', 'yesno', 'text')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_active ON questionnaire_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_section ON questionnaire_templates(section_number);
CREATE INDEX IF NOT EXISTS idx_templates_name ON questionnaire_templates(template_name);

-- =====================================================================
-- TABLA: cold_questionnaire_sections
-- =====================================================================

CREATE TABLE IF NOT EXISTS cold_questionnaire_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cold_questionnaire_id uuid NOT NULL REFERENCES cold_questionnaires(id) ON DELETE CASCADE,
  section_number integer NOT NULL,
  question_text text NOT NULL,
  answer_text text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cold_sections_questionnaire ON cold_questionnaire_sections(cold_questionnaire_id);

-- =====================================================================
-- PREGUNTAS ESTÁNDAR
-- =====================================================================

INSERT INTO questionnaire_templates (template_name, section_number, question_text, answer_type) VALUES
('hot_standard', 1, '¿El curso cumplió con tus expectativas?', 'score'),
('hot_standard', 2, '¿Los contenidos fueron claros y comprensibles?', 'score'),
('hot_standard', 3, '¿El instructor dominaba el tema?', 'score'),
('hot_standard', 4, '¿Los materiales didácticos fueron adecuados?', 'score'),
('hot_standard', 5, '¿El tiempo del curso fue suficiente?', 'score'),
('hot_standard', 6, '¿Las instalaciones fueron apropiadas?', 'score'),
('hot_standard', 7, '¿La organización del curso fue buena?', 'score'),
('hot_standard', 8, '¿Podrás aplicar lo aprendido en tu trabajo?', 'score'),
('hot_standard', 9, '¿Recomendarías este curso a otros?', 'yesno'),
('hot_standard', 10, '¿Te gustaría recibir capacitación de seguimiento?', 'yesno'),
('cold_standard', 1, '¿El empleado ha aplicado los conocimientos adquiridos?', 'text'),
('cold_standard', 2, '¿Se observan mejoras en su desempeño?', 'text'),
('cold_standard', 3, '¿Ha compartido conocimientos con el equipo?', 'text'),
('cold_standard', 4, '¿Qué resultados concretos se han observado?', 'text'),
('cold_standard', 5, 'Comentarios adicionales del evaluador', 'text')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- FUNCIÓN: Crear cuestionario caliente con plantilla
-- =====================================================================

CREATE OR REPLACE FUNCTION create_hot_questionnaire_with_template(
  p_participant_id uuid,
  p_template_name text DEFAULT 'hot_standard'
)
RETURNS uuid AS $$
DECLARE
  v_questionnaire_id uuid;
BEGIN
  INSERT INTO hot_questionnaires (participant_id)
  VALUES (p_participant_id)
  RETURNING id INTO v_questionnaire_id;

  INSERT INTO hot_section_scores (questionnaire_id, section_number, question_text, score)
  SELECT
    v_questionnaire_id,
    section_number,
    question_text,
    5
  FROM questionnaire_templates
  WHERE template_name = p_template_name
    AND answer_type = 'score'
    AND is_active = true;

  INSERT INTO hot_section_yesno (questionnaire_id, section_number, question_text, answer)
  SELECT
    v_questionnaire_id,
    section_number,
    question_text,
    false
  FROM questionnaire_templates
  WHERE template_name = p_template_name
    AND answer_type = 'yesno'
    AND is_active = true;

  RETURN v_questionnaire_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Obtener cuestionario completo
-- =====================================================================

CREATE OR REPLACE FUNCTION get_hot_questionnaire_full(p_questionnaire_id uuid)
RETURNS TABLE (
  section_number integer,
  question_text text,
  answer_type text,
  answer_value text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hss.section_number,
    hss.question_text,
    'score'::text AS answer_type,
    hss.score::text AS answer_value
  FROM hot_section_scores hss
  WHERE hss.questionnaire_id = p_questionnaire_id

  UNION ALL

  SELECT
    hsy.section_number,
    hsy.question_text,
    'yesno'::text AS answer_type,
    CASE WHEN hsy.answer THEN 'Sí' ELSE 'No' END AS answer_value
  FROM hot_section_yesno hsy
  WHERE hsy.questionnaire_id = p_questionnaire_id

  ORDER BY section_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Validar cuestionario completo
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_hot_questionnaire_complete(p_questionnaire_id uuid)
RETURNS boolean AS $$
DECLARE
  v_score_count integer;
  v_yesno_count integer;
  v_expected_score integer;
  v_expected_yesno integer;
BEGIN
  SELECT COUNT(*) INTO v_score_count
  FROM hot_section_scores
  WHERE questionnaire_id = p_questionnaire_id;

  SELECT COUNT(*) INTO v_yesno_count
  FROM hot_section_yesno
  WHERE questionnaire_id = p_questionnaire_id;

  SELECT COUNT(*) INTO v_expected_score
  FROM questionnaire_templates
  WHERE template_name = 'hot_standard' AND answer_type = 'score' AND is_active = true;

  SELECT COUNT(*) INTO v_expected_yesno
  FROM questionnaire_templates
  WHERE template_name = 'hot_standard' AND answer_type = 'yesno' AND is_active = true;

  RETURN (v_score_count >= v_expected_score AND v_yesno_count >= v_expected_yesno);
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Bloquear cuestionario con validación
-- =====================================================================

CREATE OR REPLACE FUNCTION lock_hot_questionnaire(p_questionnaire_id uuid)
RETURNS boolean AS $$
DECLARE
  v_is_complete boolean;
BEGIN
  SELECT validate_hot_questionnaire_complete(p_questionnaire_id) INTO v_is_complete;

  IF NOT v_is_complete THEN
    RAISE EXCEPTION 'El cuestionario no está completo. Debe responder todas las preguntas.';
  END IF;

  UPDATE hot_questionnaires
  SET
    completed_at = now(),
    is_locked = true
  WHERE id = p_questionnaire_id
    AND is_locked = false;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Crear cuestionario frío con plantilla
-- =====================================================================

CREATE OR REPLACE FUNCTION create_cold_questionnaire_with_template(
  p_participant_id uuid,
  p_hot_questionnaire_id uuid,
  p_evaluator_name text,
  p_template_name text DEFAULT 'cold_standard'
)
RETURNS uuid AS $$
DECLARE
  v_questionnaire_id uuid;
  v_can_create boolean;
BEGIN
  SELECT has_three_months_passed(p_hot_questionnaire_id) INTO v_can_create;

  IF NOT v_can_create THEN
    RAISE EXCEPTION 'No se puede crear el cuestionario frío. Deben pasar 3 meses desde el cuestionario caliente.';
  END IF;

  INSERT INTO cold_questionnaires (participant_id, hot_questionnaire_id, evaluator_name)
  VALUES (p_participant_id, p_hot_questionnaire_id, p_evaluator_name)
  RETURNING id INTO v_questionnaire_id;

  INSERT INTO cold_questionnaire_sections (cold_questionnaire_id, section_number, question_text)
  SELECT
    v_questionnaire_id,
    section_number,
    question_text
  FROM questionnaire_templates
  WHERE template_name = p_template_name
    AND answer_type = 'text'
    AND is_active = true;

  RETURN v_questionnaire_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Completar cuestionario frío con firma
-- =====================================================================

CREATE OR REPLACE FUNCTION complete_cold_questionnaire(
  p_questionnaire_id uuid,
  p_employee_signature_name text
)
RETURNS boolean AS $$
DECLARE
  v_is_locked boolean;
BEGIN
  SELECT is_locked INTO v_is_locked
  FROM cold_questionnaires
  WHERE id = p_questionnaire_id;

  IF v_is_locked THEN
    RAISE EXCEPTION 'El cuestionario ya está completado y bloqueado.';
  END IF;

  IF p_employee_signature_name IS NULL OR p_employee_signature_name = '' THEN
    RAISE EXCEPTION 'Se requiere la firma del empleado para completar el cuestionario.';
  END IF;

  UPDATE cold_questionnaires
  SET
    signature_employee_name = p_employee_signature_name,
    signature_date = now(),
    is_completed = true,
    is_locked = true
  WHERE id = p_questionnaire_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCIÓN: Reporte completo de empleado
-- =====================================================================

CREATE OR REPLACE FUNCTION get_employee_training_report(p_employee_id uuid)
RETURNS TABLE (
  course_name text,
  course_date date,
  course_year integer,
  enrolled_at timestamptz,
  hot_average decimal,
  hot_completed timestamptz,
  cold_completed boolean,
  cold_signed timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name AS course_name,
    c.date AS course_date,
    ty.year AS course_year,
    cp.enrolled_at,
    hq.average_score AS hot_average,
    hq.completed_at AS hot_completed,
    cq.is_completed AS cold_completed,
    cq.signature_date AS cold_signed
  FROM course_participants cp
  INNER JOIN courses c ON c.id = cp.course_id
  INNER JOIN training_years ty ON ty.id = c.year_id
  LEFT JOIN hot_questionnaires hq ON hq.participant_id = cp.id
  LEFT JOIN cold_questionnaires cq ON cq.participant_id = cp.id
  WHERE cp.employee_id = p_employee_id
  ORDER BY c.date DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE questionnaire_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_questionnaire_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users on questionnaire_templates"
  ON questionnaire_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all operations for authenticated users on cold_sections"
  ON cold_questionnaire_sections FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
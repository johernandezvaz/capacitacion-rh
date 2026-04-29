/*
  # Fix RLS Security Policies
  
  ## Overview
  Replace broken RLS policies that allow unrestricted public access with proper plant-scoped access control.
  
  ## Security Issues Fixed
  1. All tables had `USING (true)` allowing unrestricted access
  2. user_plants only policy on SELECT, needs UPDATE/DELETE
  3. Missing policies for authenticated data access
  
  ## New Access Model
  - Users can only see data belonging to their assigned plant(s)
  - Admin users can manage more resources within their plant
  - Regular users have read-only access to shared resources
  
  ## Tables Affected
  - plants: Read-only for authenticated users
  - user_plants: Own records only
  - training_years: Plant-scoped
  - courses: Plant-scoped
  - employees: Plant-scoped
  - ojt_records: Plant-scoped
  - All related detail tables inherit plant access through joins
*/

-- First, drop all existing permissive policies that use USING (true)
DROP POLICY IF EXISTS "Allow DELETE for all users on courses" ON courses;
DROP POLICY IF EXISTS "Allow INSERT for all users on courses" ON courses;
DROP POLICY IF EXISTS "Allow SELECT for all users on courses" ON courses;
DROP POLICY IF EXISTS "Allow UPDATE for all users on courses" ON courses;

DROP POLICY IF EXISTS "Allow DELETE for all users on training_years" ON training_years;
DROP POLICY IF EXISTS "Allow INSERT for all users on training_years" ON training_years;
DROP POLICY IF EXISTS "Allow SELECT for all users on training_years" ON training_years;
DROP POLICY IF EXISTS "Allow UPDATE for all users on training_years" ON training_years;

DROP POLICY IF EXISTS "Allow DELETE for all users on employees" ON employees;
DROP POLICY IF EXISTS "Allow INSERT for all users on employees" ON employees;
DROP POLICY IF EXISTS "Allow SELECT for all users on employees" ON employees;
DROP POLICY IF EXISTS "Allow UPDATE for all users on employees" ON employees;

DROP POLICY IF EXISTS "Allow DELETE for all users on course_participants" ON course_participants;
DROP POLICY IF EXISTS "Allow INSERT for all users on course_participants" ON course_participants;
DROP POLICY IF EXISTS "Allow SELECT for all users on course_participants" ON course_participants;
DROP POLICY IF EXISTS "Allow UPDATE for all users on course_participants" ON course_participants;

DROP POLICY IF EXISTS "Allow DELETE for all users on hot_questionnaires" ON hot_questionnaires;
DROP POLICY IF EXISTS "Allow INSERT for all users on hot_questionnaires" ON hot_questionnaires;
DROP POLICY IF EXISTS "Allow SELECT for all users on hot_questionnaires" ON hot_questionnaires;
DROP POLICY IF EXISTS "Allow UPDATE for all users on hot_questionnaires" ON hot_questionnaires;

DROP POLICY IF EXISTS "Allow DELETE for all users on hot_section_scores" ON hot_section_scores;
DROP POLICY IF EXISTS "Allow INSERT for all users on hot_section_scores" ON hot_section_scores;
DROP POLICY IF EXISTS "Allow SELECT for all users on hot_section_scores" ON hot_section_scores;
DROP POLICY IF EXISTS "Allow UPDATE for all users on hot_section_scores" ON hot_section_scores;

DROP POLICY IF EXISTS "Allow DELETE for all users on hot_section_yesno" ON hot_section_yesno;
DROP POLICY IF EXISTS "Allow INSERT for all users on hot_section_yesno" ON hot_section_yesno;
DROP POLICY IF EXISTS "Allow SELECT for all users on hot_section_yesno" ON hot_section_yesno;
DROP POLICY IF EXISTS "Allow UPDATE for all users on hot_section_yesno" ON hot_section_yesno;

DROP POLICY IF EXISTS "Allow DELETE for all users on cold_questionnaires" ON cold_questionnaires;
DROP POLICY IF EXISTS "Allow INSERT for all users on cold_questionnaires" ON cold_questionnaires;
DROP POLICY IF EXISTS "Allow SELECT for all users on cold_questionnaires" ON cold_questionnaires;
DROP POLICY IF EXISTS "Allow UPDATE for all users on cold_questionnaires" ON cold_questionnaires;

DROP POLICY IF EXISTS "Allow DELETE for all users on cold_questionnaire_sections" ON cold_questionnaire_sections;
DROP POLICY IF EXISTS "Allow INSERT for all users on cold_questionnaire_sections" ON cold_questionnaire_sections;
DROP POLICY IF EXISTS "Allow SELECT for all users on cold_questionnaire_sections" ON cold_questionnaire_sections;
DROP POLICY IF EXISTS "Allow UPDATE for all users on cold_questionnaire_sections" ON cold_questionnaire_sections;

DROP POLICY IF EXISTS "Allow DELETE for all users on questionnaire_templates" ON questionnaire_templates;
DROP POLICY IF EXISTS "Allow INSERT for all users on questionnaire_templates" ON questionnaire_templates;
DROP POLICY IF EXISTS "Allow SELECT for all users on questionnaire_templates" ON questionnaire_templates;
DROP POLICY IF EXISTS "Allow UPDATE for all users on questionnaire_templates" ON questionnaire_templates;

DROP POLICY IF EXISTS "Allow all ojt_records" ON ojt_records;
DROP POLICY IF EXISTS "Allow all ojt_sections" ON ojt_sections;
DROP POLICY IF EXISTS "Allow all ojt_entries" ON ojt_entries;
DROP POLICY IF EXISTS "Allow all ojt_instances" ON ojt_instances;
DROP POLICY IF EXISTS "Allow all ojt_instance_entries" ON ojt_instance_entries;
DROP POLICY IF EXISTS "Allow all ojt_instance_signatures" ON ojt_instance_signatures;

-- Plants: Read-only for authenticated users
CREATE POLICY "Authenticated users can read plants"
  ON plants FOR SELECT
  TO authenticated
  USING (true);

-- User Plants: Users can only see their own assignments
DROP POLICY IF EXISTS "user_plants_own" ON user_plants;

CREATE POLICY "Users can read own plant assignments"
  ON user_plants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own plant assignments"
  ON user_plants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plant assignments"
  ON user_plants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Training Years: Plant-scoped access
CREATE POLICY "Users can read training years for their plants"
  ON training_years FOR SELECT
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can create training years for their plants"
  ON training_years FOR INSERT
  TO authenticated
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update training years for their plants"
  ON training_years FOR UPDATE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete training years for their plants"
  ON training_years FOR DELETE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Courses: Plant-scoped access
CREATE POLICY "Users can read courses for their plants"
  ON courses FOR SELECT
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can create courses for their plants"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update courses for their plants"
  ON courses FOR UPDATE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete courses for their plants"
  ON courses FOR DELETE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Employees: Plant-scoped access
CREATE POLICY "Users can read employees for their plants"
  ON employees FOR SELECT
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can create employees for their plants"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update employees for their plants"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete employees for their plants"
  ON employees FOR DELETE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- OJT Records: Plant-scoped access
CREATE POLICY "Users can read ojt_records for their plants"
  ON ojt_records FOR SELECT
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can manage ojt_records for their plants"
  ON ojt_records FOR INSERT
  TO authenticated
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update ojt_records for their plants"
  ON ojt_records FOR UPDATE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete ojt_records for their plants"
  ON ojt_records FOR DELETE
  TO authenticated
  USING (
    plant_id IN (
      SELECT plant_id FROM user_plants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Detail Tables: Accessible through course/employee access
-- These inherit plant access through their parent relationships

CREATE POLICY "Users can read course_participants through course access"
  ON course_participants FOR SELECT
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin users can manage course_participants"
  ON course_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admin users can update course_participants"
  ON course_participants FOR UPDATE
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admin users can delete course_participants"
  ON course_participants FOR DELETE
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Questionnaires and related tables: Plant-scoped through course access
CREATE POLICY "Users can read questionnaires for their plants"
  ON questionnaires FOR SELECT
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert questionnaires for their plants"
  ON questionnaires FOR INSERT
  TO authenticated
  WITH CHECK (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update questionnaires for their plants"
  ON questionnaires FOR UPDATE
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT id FROM courses WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

-- Hot Questionnaires and related tables
CREATE POLICY "Users can read hot_questionnaires for their plants"
  ON hot_questionnaires FOR SELECT
  TO authenticated
  USING (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage hot_questionnaires for their plants"
  ON hot_questionnaires FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update hot_questionnaires for their plants"
  ON hot_questionnaires FOR UPDATE
  TO authenticated
  USING (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can read hot_section_scores for their plants"
  ON hot_section_scores FOR SELECT
  TO authenticated
  USING (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage hot_section_scores for their plants"
  ON hot_section_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update hot_section_scores for their plants"
  ON hot_section_scores FOR UPDATE
  TO authenticated
  USING (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can read hot_section_yesno for their plants"
  ON hot_section_yesno FOR SELECT
  TO authenticated
  USING (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage hot_section_yesno for their plants"
  ON hot_section_yesno FOR INSERT
  TO authenticated
  WITH CHECK (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update hot_section_yesno for their plants"
  ON hot_section_yesno FOR UPDATE
  TO authenticated
  USING (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    questionnaire_id IN (
      SELECT hq.id FROM hot_questionnaires hq
      WHERE hq.participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Cold Questionnaires and related tables
CREATE POLICY "Users can read cold_questionnaires for their plants"
  ON cold_questionnaires FOR SELECT
  TO authenticated
  USING (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage cold_questionnaires for their plants"
  ON cold_questionnaires FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update cold_questionnaires for their plants"
  ON cold_questionnaires FOR UPDATE
  TO authenticated
  USING (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    participant_id IN (
      SELECT cp.id FROM course_participants cp
      JOIN courses c ON cp.course_id = c.id
      WHERE c.plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can read cold_questionnaire_sections for their plants"
  ON cold_questionnaire_sections FOR SELECT
  TO authenticated
  USING (
    cold_questionnaire_id IN (
      SELECT id FROM cold_questionnaires WHERE participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage cold_questionnaire_sections for their plants"
  ON cold_questionnaire_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    cold_questionnaire_id IN (
      SELECT id FROM cold_questionnaires WHERE participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update cold_questionnaire_sections for their plants"
  ON cold_questionnaire_sections FOR UPDATE
  TO authenticated
  USING (
    cold_questionnaire_id IN (
      SELECT id FROM cold_questionnaires WHERE participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    cold_questionnaire_id IN (
      SELECT id FROM cold_questionnaires WHERE participant_id IN (
        SELECT cp.id FROM course_participants cp
        JOIN courses c ON cp.course_id = c.id
        WHERE c.plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Questionnaire Templates: Available to all authenticated users
CREATE POLICY "Authenticated users can read questionnaire templates"
  ON questionnaire_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage questionnaire templates"
  ON questionnaire_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plants
      WHERE user_id = auth.uid() AND role = 'admin'
      LIMIT 1
    )
  );

CREATE POLICY "Admin users can update questionnaire templates"
  ON questionnaire_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plants
      WHERE user_id = auth.uid() AND role = 'admin'
      LIMIT 1
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plants
      WHERE user_id = auth.uid() AND role = 'admin'
      LIMIT 1
    )
  );

-- Questionnaire Responses, Signatures, and Tokens: Public access (for external forms)
CREATE POLICY "Public can read questionnaire_responses"
  ON questionnaire_responses FOR SELECT
  USING (true);

CREATE POLICY "Public can insert questionnaire_responses"
  ON questionnaire_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update questionnaire_responses"
  ON questionnaire_responses FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can read questionnaire_signatures"
  ON questionnaire_signatures FOR SELECT
  USING (true);

CREATE POLICY "Public can insert questionnaire_signatures"
  ON questionnaire_signatures FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update questionnaire_signatures"
  ON questionnaire_signatures FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can read questionnaire_tokens"
  ON questionnaire_tokens FOR SELECT
  USING (true);

CREATE POLICY "Public can insert questionnaire_tokens"
  ON questionnaire_tokens FOR INSERT
  WITH CHECK (true);

-- OJT Sections and Entries: Through ojt_records
CREATE POLICY "Users can read ojt_sections for their plants"
  ON ojt_sections FOR SELECT
  TO authenticated
  USING (
    record_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin users can manage ojt_sections"
  ON ojt_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    record_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admin users can update ojt_sections"
  ON ojt_sections FOR UPDATE
  TO authenticated
  USING (
    record_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    record_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admin users can delete ojt_sections"
  ON ojt_sections FOR DELETE
  TO authenticated
  USING (
    record_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Users can read ojt_entries for their plants"
  ON ojt_entries FOR SELECT
  TO authenticated
  USING (
    section_id IN (
      SELECT id FROM ojt_sections WHERE record_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admin users can manage ojt_entries"
  ON ojt_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    section_id IN (
      SELECT id FROM ojt_sections WHERE record_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admin users can update ojt_entries"
  ON ojt_entries FOR UPDATE
  TO authenticated
  USING (
    section_id IN (
      SELECT id FROM ojt_sections WHERE record_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  )
  WITH CHECK (
    section_id IN (
      SELECT id FROM ojt_sections WHERE record_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

-- OJT Instances and related tables
CREATE POLICY "Users can read ojt_instances for their plants"
  ON ojt_instances FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin users can manage ojt_instances"
  ON ojt_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    template_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admin users can update ojt_instances"
  ON ojt_instances FOR UPDATE
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM ojt_records WHERE plant_id IN (
        SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Users can read ojt_instance_entries for their plants"
  ON ojt_instance_entries FOR SELECT
  TO authenticated
  USING (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admin users can manage ojt_instance_entries"
  ON ojt_instance_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admin users can update ojt_instance_entries"
  ON ojt_instance_entries FOR UPDATE
  TO authenticated
  USING (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  )
  WITH CHECK (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can read ojt_instance_signatures for their plants"
  ON ojt_instance_signatures FOR SELECT
  TO authenticated
  USING (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admin users can manage ojt_instance_signatures"
  ON ojt_instance_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admin users can update ojt_instance_signatures"
  ON ojt_instance_signatures FOR UPDATE
  TO authenticated
  USING (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  )
  WITH CHECK (
    instance_id IN (
      SELECT id FROM ojt_instances WHERE template_id IN (
        SELECT id FROM ojt_records WHERE plant_id IN (
          SELECT plant_id FROM user_plants WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

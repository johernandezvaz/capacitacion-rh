/*
  # Sistema de Gestión de Capacitaciones - Tablas Iniciales

  ## Descripción
  Crea las tablas base para el sistema de gestión de capacitaciones corporativas.
  
  ## Tablas Nuevas
  
  ### `training_years`
  Almacena los años de capacitación disponibles en el sistema.
  - `id` (uuid, primary key): Identificador único
  - `year` (integer, unique): Año de capacitación (ej: 2024, 2025)
  - `created_at` (timestamptz): Fecha de creación del registro
  
  ### `courses`
  Almacena los cursos asociados a cada año de capacitación.
  - `id` (uuid, primary key): Identificador único
  - `year_id` (uuid, foreign key): Referencia al año de capacitación
  - `name` (text): Nombre del curso
  - `date` (date): Fecha programada del curso
  - `duration_hours` (integer): Duración en horas
  - `status` (text): Estado del curso (draft, active, closed)
  - `created_at` (timestamptz): Fecha de creación del registro
  
  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas permisivas para usuarios autenticados (sistema interno)
  
  ## Notas Importantes
  - El año debe ser único para evitar duplicados
  - Los cursos están vinculados a un año mediante foreign key con cascade
  - Estado por defecto de cursos: 'draft'
*/

-- Tabla de Años de Capacitación
CREATE TABLE IF NOT EXISTS training_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabla de Cursos
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES training_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  duration_hours integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_courses_year_id ON courses(year_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);

-- Habilitar Row Level Security
ALTER TABLE training_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para training_years
CREATE POLICY "Allow all operations for authenticated users on training_years"
  ON training_years
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para courses
CREATE POLICY "Allow all operations for authenticated users on courses"
  ON courses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
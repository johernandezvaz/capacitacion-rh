-- ============================================================
-- Modificar tipo de dato de duration_hours a NUMERIC
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE courses
  ALTER COLUMN duration_hours TYPE NUMERIC(5,2);

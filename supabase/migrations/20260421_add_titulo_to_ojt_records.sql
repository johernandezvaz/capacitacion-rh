-- ============================================================
-- OJT — Agregar columna titulo a ojt_records
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE ojt_records
  ADD COLUMN IF NOT EXISTS titulo text;

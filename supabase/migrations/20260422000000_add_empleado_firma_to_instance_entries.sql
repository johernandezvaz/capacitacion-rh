-- Add employee signature field to ojt_instance_entries
ALTER TABLE ojt_instance_entries
  ADD COLUMN IF NOT EXISTS empleado_firma_url TEXT;

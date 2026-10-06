-- Permite que una instancia OJT use un puesto responsable distinto al de la plantilla.
-- NULL conserva el comportamiento actual: mostrar el puesto definido en la plantilla.
ALTER TABLE public.ojt_instance_entries
  ADD COLUMN IF NOT EXISTS puesto_responsable text;

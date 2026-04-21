-- ============================================================
-- OJT — Registro de Entrenamiento en el Puesto
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================

-- 1. ojt_records — Registro principal
CREATE TABLE IF NOT EXISTS ojt_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             uuid REFERENCES employees(id) ON DELETE SET NULL,
  puesto                  text,
  nombre                  text,
  fecha_inicio            date,
  fecha_termino           date,
  piloto_proceso          text,
  periodo_entrenamiento   text,
  jefe_directo_id         uuid REFERENCES employees(id) ON DELETE SET NULL,
  integrante_brigada_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
  status                  text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'in_progress', 'completed', 'locked')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 2. ojt_sections — Secciones del registro
CREATE TABLE IF NOT EXISTS ojt_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   uuid NOT NULL REFERENCES ojt_records(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('conocimientos_generales', 'actividad')),
  nombre      text NOT NULL,
  orden       integer NOT NULL DEFAULT 0
);

-- 3. ojt_entries — Filas de cada sección
CREATE TABLE IF NOT EXISTS ojt_entries (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id                  uuid NOT NULL REFERENCES ojt_sections(id) ON DELETE CASCADE,
  orden                       integer NOT NULL DEFAULT 0,
  conocimiento_requerido      text,
  habilidades                 text,
  fuentes_informacion         text,
  procedimientos_internos     text,
  metodo_entrenamiento        text,
  duracion                    text,
  fecha_planeada_terminacion  date,
  fecha_real_inicio           date,
  fecha_real_termino          date,
  responsable_entrenamiento   text,
  firma_empleado              text,
  firma_empleado_at           timestamptz,
  comentarios                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- 4. ojt_signatures — Firmas de liberación del registro
CREATE TABLE IF NOT EXISTS ojt_signatures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    uuid NOT NULL REFERENCES ojt_records(id) ON DELETE CASCADE,
  signer_type  text NOT NULL CHECK (signer_type IN ('empleado', 'jefe_directo', 'recursos_humanos')),
  signer_name  text,
  signed_at    date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, signer_type)
);

-- ─── Trigger: updated_at automático ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ojt_records_updated_at
  BEFORE UPDATE ON ojt_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ojt_entries_updated_at
  BEFORE UPDATE ON ojt_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS — Política "Allow all" para rol public ───────────────────────────────
ALTER TABLE ojt_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_signatures ENABLE ROW LEVEL SECURITY;

-- ojt_records
CREATE POLICY "Allow all for public" ON ojt_records FOR ALL TO public USING (true) WITH CHECK (true);
-- ojt_sections
CREATE POLICY "Allow all for public" ON ojt_sections FOR ALL TO public USING (true) WITH CHECK (true);
-- ojt_entries
CREATE POLICY "Allow all for public" ON ojt_entries FOR ALL TO public USING (true) WITH CHECK (true);
-- ojt_signatures
CREATE POLICY "Allow all for public" ON ojt_signatures FOR ALL TO public USING (true) WITH CHECK (true);

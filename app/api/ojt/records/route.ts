import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pool, query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const plantId = searchParams.get('plant_id');

  try {
    if (id) {
      const recRes = await query(
        `SELECT r.*, e.nombre AS jefe_directo_nombre
         FROM ojt_records r
         LEFT JOIN employees e ON e.id = r.jefe_directo_id
         WHERE r.id = $1`,
        [id]
      );
      if (recRes.rowCount === 0) {
        return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
      }

      const secRes = await query(
        `SELECT * FROM ojt_sections WHERE record_id = $1 ORDER BY orden ASC`,
        [id]
      );

      const secIds = secRes.rows.map(s => s.id);
      let entries: any[] = [];

      if (secIds.length > 0) {
        const entRes = await query(
          `SELECT * FROM ojt_entries WHERE section_id = ANY($1::uuid[]) ORDER BY orden ASC`,
          [secIds]
        );
        entries = entRes.rows;
      }

      const sections = secRes.rows.map(s => ({
        ...s,
        entries: entries.filter(e => e.section_id === s.id),
      }));

      return NextResponse.json({ record: recRes.rows[0], sections });
    }

    if (plantId) {
      const res = await query(
        `SELECT * FROM ojt_records WHERE is_template = true AND plant_id = $1 ORDER BY puesto ASC, titulo ASC`,
        [plantId]
      );
      return NextResponse.json({ records: res.rows });
    }

    return NextResponse.json({ records: [] });
  } catch (error: any) {
    console.error('[api/ojt/records] GET error:', error);
    return NextResponse.json({ error: error.message || 'Error en servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      id,
      titulo,
      puesto,
      periodo_entrenamiento,
      es_piloto_proceso,
      piloto_proceso_codigo,
      es_integrante_brigada,
      plant_id,
      sections,
    } = body;

    await client.query('BEGIN');

    let recordId = id;

    if (recordId) {
      await client.query(
        `UPDATE ojt_records SET
          titulo = $1, puesto = $2, periodo_entrenamiento = $3,
          es_piloto_proceso = $4, piloto_proceso_codigo = $5, es_integrante_brigada = $6
         WHERE id = $7`,
        [
          titulo ? titulo.trim() : '',
          puesto ? puesto.trim() : '',
          periodo_entrenamiento ? periodo_entrenamiento.trim() : null,
          !!es_piloto_proceso,
          piloto_proceso_codigo ? piloto_proceso_codigo.trim() : null,
          !!es_integrante_brigada,
          recordId,
        ]
      );
    } else {
      const recRes = await client.query(
        `INSERT INTO ojt_records (
          titulo, puesto, periodo_entrenamiento, es_piloto_proceso,
          piloto_proceso_codigo, es_integrante_brigada, is_template, plant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        RETURNING id`,
        [
          titulo ? titulo.trim() : '',
          puesto ? puesto.trim() : '',
          periodo_entrenamiento ? periodo_entrenamiento.trim() : null,
          !!es_piloto_proceso,
          piloto_proceso_codigo ? piloto_proceso_codigo.trim() : null,
          !!es_integrante_brigada,
          plant_id || null,
        ]
      );
      recordId = recRes.rows[0].id;
    }

    if (Array.isArray(sections)) {
      // Synchronize sections
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx];
        let secId = sec.id;

        if (secId && !secId.startsWith('new_')) {
          await client.query(
            `UPDATE ojt_sections SET nombre = $1, orden = $2 WHERE id = $3`,
            [sec.nombre ? sec.nombre.trim() : '', sIdx, secId]
          );
        } else {
          const secIns = await client.query(
            `INSERT INTO ojt_sections (record_id, nombre, orden) VALUES ($1, $2, $3) RETURNING id`,
            [recordId, sec.nombre ? sec.nombre.trim() : '', sIdx]
          );
          secId = secIns.rows[0].id;
        }

        if (Array.isArray(sec.entries)) {
          for (let eIdx = 0; eIdx < sec.entries.length; eIdx++) {
            const ent = sec.entries[eIdx];
            if (ent.id && !ent.id.startsWith('new_')) {
              await client.query(
                `UPDATE ojt_entries SET
                  conocimiento_requerido = $1, habilidades = $2, fuentes_informacion = $3,
                  procedimientos_internos = $4, metodo_entrenamiento = $5, duracion = $6,
                  puesto_responsable = $7, orden = $8
                 WHERE id = $9`,
                [
                  ent.conocimiento_requerido || null,
                  ent.habilidades || null,
                  ent.fuentes_informacion || null,
                  ent.procedimientos_internos || null,
                  ent.metodo_entrenamiento || null,
                  ent.duracion || null,
                  ent.puesto_responsable || null,
                  eIdx,
                  ent.id,
                ]
              );
            } else {
              await client.query(
                `INSERT INTO ojt_entries (
                  section_id, conocimiento_requerido, habilidades, fuentes_informacion,
                  procedimientos_internos, metodo_entrenamiento, duracion, puesto_responsable, orden
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  secId,
                  ent.conocimiento_requerido || null,
                  ent.habilidades || null,
                  ent.fuentes_informacion || null,
                  ent.procedimientos_internos || null,
                  ent.metodo_entrenamiento || null,
                  ent.duracion || null,
                  ent.puesto_responsable || null,
                  eIdx,
                ]
              );
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ id: recordId, ok: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[api/ojt/records] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar plantilla OJT' }, { status: 500 });
  } finally {
    client.release();
  }
}

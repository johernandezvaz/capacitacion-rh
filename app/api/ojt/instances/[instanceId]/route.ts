import { NextRequest, NextResponse } from 'next/server';
import { pool, query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

    const instRes = await query(
      `SELECT i.*,
              e.nombre AS empleado_nombre,
              j.nombre AS jefe_nombre
       FROM ojt_instances i
       LEFT JOIN employees e ON e.id = i.employee_id
       LEFT JOIN employees j ON j.id = i.jefe_directo_id
       WHERE i.id = $1`,
      [instanceId]
    );

    if (instRes.rowCount === 0) {
      return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
    }

    const instance = instRes.rows[0];
    const templateId = instance.template_id;

    const tmplRes = await query(
      `SELECT r.*, e.nombre AS jefe_directo_nombre
       FROM ojt_records r
       LEFT JOIN employees e ON e.id = r.jefe_directo_id
       WHERE r.id = $1`,
      [templateId]
    );
    const template = tmplRes.rows[0] || null;

    const secRes = await query(
      `SELECT id, tipo, nombre, orden FROM ojt_sections WHERE record_id = $1 ORDER BY orden ASC`,
      [templateId]
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

    const ieRes = await query(
      `SELECT * FROM ojt_instance_entries WHERE instance_id = $1`,
      [instanceId]
    );
    const instanceEntries = ieRes.rows;

    const sigRes = await query(
      `SELECT * FROM ojt_instance_signatures WHERE instance_id = $1`,
      [instanceId]
    );
    const signatures = sigRes.rows;

    const sections = secRes.rows.map(s => ({
      ...s,
      entries: entries.filter(e => e.section_id === s.id).map(e => ({
        ...e,
        instance_entry: instanceEntries.find(ie => ie.entry_id === e.id) || null,
      })),
    }));

    return NextResponse.json({
      instance,
      template,
      sections,
      signatures,
    });
  } catch (error: any) {
    console.error('[api/ojt/instances/[instanceId]] GET error:', error);
    return NextResponse.json({ error: error.message || 'Error en servidor' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const client = await pool.connect();
  try {
    const { instanceId } = await params;
    const body = await request.json();
    const {
      employee_id,
      jefe_directo_id,
      nombre,
      fecha_inicio,
      fecha_termino,
      average_efectividad,
      instance_entry,
      signature,
    } = body;

    await client.query('BEGIN');

    if (employee_id !== undefined || nombre !== undefined || average_efectividad !== undefined) {
      await client.query(
        `UPDATE ojt_instances SET
          employee_id = $1, jefe_directo_id = $2, nombre = $3,
          fecha_inicio = $4, fecha_termino = $5, average_efectividad = $6,
          updated_at = NOW()
         WHERE id = $7`,
        [
          employee_id || null,
          jefe_directo_id || null,
          nombre || null,
          fecha_inicio || null,
          fecha_termino || null,
          average_efectividad != null ? parseFloat(average_efectividad) : null,
          instanceId,
        ]
      );
    }

    if (instance_entry) {
      const { id: ieId, entry_id, ...fields } = instance_entry;
      let existingIeId = ieId;

      if (!existingIeId && entry_id) {
        const checkRes = await client.query(
          `SELECT id FROM ojt_instance_entries WHERE instance_id = $1 AND entry_id = $2`,
          [instanceId, entry_id]
        );
        if (checkRes.rowCount && checkRes.rowCount > 0) {
          existingIeId = checkRes.rows[0].id;
        }
      }

      if (existingIeId) {
        const keys = Object.keys(fields).filter(k => fields[k] !== undefined);
        if (keys.length > 0) {
          const setClause = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
          const values = keys.map(k => fields[k]);
          await client.query(
            `UPDATE ojt_instance_entries SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
            [...values, existingIeId]
          );
        }
      } else if (entry_id) {
        const keys = Object.keys(fields).filter(k => fields[k] !== undefined);
        const cols = ['instance_id', 'entry_id', ...keys.map(k => `"${k}"`)].join(', ');
        const placeholders = ['$1', '$2', ...keys.map((_, idx) => `$${idx + 3}`)].join(', ');
        const values = [instanceId, entry_id, ...keys.map(k => fields[k])];

        const insRes = await client.query(
          `INSERT INTO ojt_instance_entries (${cols}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        existingIeId = insRes.rows[0].id;
      }

      await client.query('COMMIT');
      return NextResponse.json({ instance_entry_id: existingIeId, ok: true });
    }

    if (signature) {
      const { signer_type, signer_name, signed_at, firma_url } = signature;
      const sigRes = await client.query(
        `INSERT INTO ojt_instance_signatures (instance_id, signer_type, signer_name, signed_at, firma_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (instance_id, signer_type) DO UPDATE SET
          signer_name = EXCLUDED.signer_name,
          signed_at = EXCLUDED.signed_at,
          firma_url = EXCLUDED.firma_url,
          updated_at = NOW()
         RETURNING *`,
        [instanceId, signer_type, signer_name || null, signed_at || null, firma_url || null]
      );
      await client.query('COMMIT');
      return NextResponse.json({ signature: sigRes.rows[0], ok: true });
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[api/ojt/instances/[instanceId]] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar instancia' }, { status: 500 });
  } finally {
    client.release();
  }
}

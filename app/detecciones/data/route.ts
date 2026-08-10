import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pool, query } from '@/lib/db';

function unauthorized() {
  return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
}

export async function GET(request: Request) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  const { searchParams } = new URL(request.url);
  const plantId = searchParams.get('plantId');
  const yearId = searchParams.get('yearId');
  if (!plantId || !yearId) return NextResponse.json({ error: 'Planta y año son requeridos.' }, { status: 400 });

  try {
    const [deteccionesResult, employeesResult] = await Promise.all([
      query(
        `SELECT d.*, d.costo::float8 AS costo, d.duration_hours::float8 AS duration_hours,
                c.id AS course_id, c.name AS course_name
         FROM detecciones d
         LEFT JOIN courses c ON c.deteccion_id = d.id
         WHERE d.plant_id = $1 AND d.year_id = $2`,
        [plantId, yearId]
      ),
      query(
        `SELECT de.deteccion_id, de.employee_id, de.color, de.status,
                jsonb_build_object('id', e.id, 'nombre', e.nombre, 'puesto', e.puesto, 'area', e.area, 'es_baja', e.es_baja) AS employees
         FROM deteccion_empleados de
         INNER JOIN detecciones d ON d.id = de.deteccion_id
         INNER JOIN employees e ON e.id = de.employee_id
         WHERE d.plant_id = $1 AND d.year_id = $2`,
        [plantId, yearId]
      ),
    ]);
    return NextResponse.json({ detecciones: deteccionesResult.rows, employeeLinks: employeesResult.rows });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar las detecciones.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized();

  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      id,
      nombre,
      color,
      status,
      plant_id,
      year_id,
      inst_interno,
      inst_externo,
      proveedor_sugerido,
      costo,
      fecha_programada,
      fecha_real,
      duration_hours,
      desarrollo_personal,
      habilidades_blandas,
      prevencion_riesgos,
      habilidades_tecnicas,
      employee_ids,
      linked_course_id,
    } = body;

    if (!nombre || !plant_id || !year_id) {
      return NextResponse.json({ error: 'Nombre, planta y año son requeridos.' }, { status: 400 });
    }

    await client.query('BEGIN');

    let detId = id;

    if (detId) {
      await client.query(
        `UPDATE detecciones SET
          nombre = $1, color = $2, status = $3, inst_interno = $4, inst_externo = $5,
          proveedor_sugerido = $6, costo = $7, fecha_programada = $8, fecha_real = $9,
          duration_hours = $10, desarrollo_personal = $11, habilidades_blandas = $12,
          prevencion_riesgos = $13, habilidades_tecnicas = $14
         WHERE id = $15`,
        [
          nombre.trim(),
          color || '#ef4444',
          status || null,
          !!inst_interno,
          !!inst_externo,
          proveedor_sugerido ? proveedor_sugerido.trim() : null,
          costo != null ? parseFloat(costo) : null,
          fecha_programada || null,
          fecha_real || null,
          duration_hours != null ? parseFloat(duration_hours) : null,
          !!desarrollo_personal,
          !!habilidades_blandas,
          !!prevencion_riesgos,
          !!habilidades_tecnicas,
          detId,
        ]
      );
    } else {
      const insRes = await client.query(
        `INSERT INTO detecciones (
          nombre, color, status, plant_id, year_id, inst_interno, inst_externo,
          proveedor_sugerido, costo, fecha_programada, fecha_real, duration_hours,
          desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16
        ) RETURNING id`,
        [
          nombre.trim(),
          color || '#ef4444',
          status || null,
          plant_id,
          year_id,
          !!inst_interno,
          !!inst_externo,
          proveedor_sugerido ? proveedor_sugerido.trim() : null,
          costo != null ? parseFloat(costo) : null,
          fecha_programada || null,
          fecha_real || null,
          duration_hours != null ? parseFloat(duration_hours) : null,
          !!desarrollo_personal,
          !!habilidades_blandas,
          !!prevencion_riesgos,
          !!habilidades_tecnicas,
        ]
      );
      detId = insRes.rows[0].id;
    }

    if (Array.isArray(employee_ids)) {
      await client.query(`DELETE FROM deteccion_empleados WHERE deteccion_id = $1`, [detId]);
      for (const empId of employee_ids) {
        await client.query(
          `INSERT INTO deteccion_empleados (deteccion_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [detId, empId]
        );
      }
    }

    if (linked_course_id) {
      await client.query(
        `UPDATE courses SET
          deteccion_id = $1, inst_interno = $2, inst_externo = $3, proveedor_sugerido = $4,
          costo = $5, desarrollo_personal = $6, habilidades_blandas = $7, prevencion_riesgos = $8,
          habilidades_tecnicas = $9, fecha_programada = $10, fecha_real = $11, duration_hours = $12
         WHERE id = $13`,
        [
          detId,
          !!inst_interno,
          !!inst_externo,
          proveedor_sugerido ? proveedor_sugerido.trim() : null,
          costo != null ? parseFloat(costo) : null,
          !!desarrollo_personal,
          !!habilidades_blandas,
          !!prevencion_riesgos,
          !!habilidades_tecnicas,
          fecha_programada || null,
          fecha_real || null,
          duration_hours != null ? parseFloat(duration_hours) : null,
          linked_course_id,
        ]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ id: detId, ok: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[api/detecciones/data] POST error:', error);
    return NextResponse.json({ error: error?.message || 'Error al guardar la detección.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  try {
    const body = await request.json();
    const { deteccionId, employeeId, color, status } = body;
    if (!deteccionId || !employeeId) {
      return NextResponse.json({ error: 'Detección y empleado son requeridos.' }, { status: 400 });
    }
    await query(
      `UPDATE deteccion_empleados SET color = $1, status = $2 WHERE deteccion_id = $3 AND employee_id = $4`,
      [color, status || null, deteccionId, employeeId]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el estado.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  const { searchParams } = new URL(request.url);
  const deteccionId = searchParams.get('deteccionId');
  const employeeId = searchParams.get('employeeId');
  if (!deteccionId) return NextResponse.json({ error: 'Detección requerida.' }, { status: 400 });

  try {
    if (employeeId) {
      await query('DELETE FROM deteccion_empleados WHERE deteccion_id = $1 AND employee_id = $2', [deteccionId, employeeId]);
      return NextResponse.json({ ok: true });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM deteccion_empleados WHERE deteccion_id = $1', [deteccionId]);
      const result = await client.query('DELETE FROM detecciones WHERE id = $1 RETURNING id', [deteccionId]);
      await client.query('COMMIT');
      if (!result.rows[0]) return NextResponse.json({ error: 'Detección no encontrada.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la detección.' }, { status: 500 });
  }
}

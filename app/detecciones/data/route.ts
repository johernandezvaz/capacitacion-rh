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

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pool, query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  const { id } = await params;

  try {
    const courseResult = await query(
      `UPDATE courses
       SET status = CASE WHEN status = 'active' AND end_date < CURRENT_DATE THEN 'closed' ELSE status END
       WHERE id = $1
       RETURNING *, duration_hours::float8 AS duration_hours`,
      [id]
    );
    const course = courseResult.rows[0];
    if (!course) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 });

    const [yearResult, employeesResult] = await Promise.all([
      query('SELECT * FROM training_years WHERE id = $1', [course.year_id]),
      query(
        `SELECT
           e.*,
           cp.id AS participant_id,
           cp.course_id,
           (jsonb_agg(to_jsonb(q)) FILTER (WHERE q.type = 'hot'))->0 AS hot_questionnaire,
           (jsonb_agg(to_jsonb(q)) FILTER (WHERE q.type = 'cold'))->0 AS cold_questionnaire
         FROM course_participants cp
         INNER JOIN employees e ON e.id = cp.employee_id
         LEFT JOIN questionnaires q ON q.course_participant_id = cp.id
         WHERE cp.course_id = $1
         GROUP BY cp.id, e.id
         ORDER BY e.nombre`,
        [id]
      ),
    ]);

    return NextResponse.json({ course, year: yearResult.rows[0] || null, employees: employeesResult.rows });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar los datos del curso.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  const { id } = await params;

  try {
    const body = await request.json();
    if (body.action === 'dates') {
      const result = await query(
        'UPDATE courses SET start_date = $1, end_date = $2 WHERE id = $3 RETURNING start_date, end_date',
        [body.start_date || null, body.end_date || null, id]
      );
      if (!result.rows[0]) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 });
      return NextResponse.json(result.rows[0]);
    }
    if (body.action === 'name' && typeof body.name === 'string' && body.name.trim()) {
      const result = await query('UPDATE courses SET name = $1 WHERE id = $2 RETURNING name', [body.name.trim(), id]);
      if (!result.rows[0]) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 });
      return NextResponse.json(result.rows[0]);
    }
    return NextResponse.json({ error: 'Actualización no válida.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el curso.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM course_participants WHERE course_id = $1', [id]);
    const result = await client.query('DELETE FROM courses WHERE id = $1 RETURNING id', [id]);
    await client.query('COMMIT');
    if (!result.rows[0]) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'No se pudo eliminar el curso.' }, { status: 500 });
  } finally {
    client.release();
  }
}

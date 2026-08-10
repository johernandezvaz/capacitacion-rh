import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };
const fields = ['inst_interno', 'inst_externo', 'proveedor_sugerido', 'costo', 'fecha_programada', 'fecha_real', 'duration_hours', 'desarrollo_personal', 'habilidades_blandas', 'prevencion_riesgos', 'habilidades_tecnicas', 'comentario_dnc'] as const;

export async function GET(request: Request, { params }: RouteContext) {
  if (!(await getSessionFromRequest(request))) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
  const { id } = await params;
  try {
    const [courseResult, participantsResult] = await Promise.all([
      query(
        `SELECT c.id, c.name, c.duration_hours::float8 AS duration_hours,
                c.inst_interno, c.inst_externo, c.proveedor_sugerido, c.costo::float8 AS costo,
                c.fecha_programada, c.fecha_real, c.desarrollo_personal, c.habilidades_blandas,
                c.prevencion_riesgos, c.habilidades_tecnicas, c.comentario_dnc, ty.year AS training_year
         FROM courses c INNER JOIN training_years ty ON ty.id = c.year_id WHERE c.id = $1`,
        [id]
      ),
      query(
        `SELECT e.id, e.nombre, e.puesto, e.area
         FROM course_participants cp INNER JOIN employees e ON e.id = cp.employee_id
         WHERE cp.course_id = $1 ORDER BY e.nombre`,
        [id]
      ),
    ]);
    if (!courseResult.rows[0]) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 });
    return NextResponse.json({ course: courseResult.rows[0], participants: participantsResult.rows });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar los datos del DNC.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await getSessionFromRequest(request))) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    const values = fields.map((field) => body[field] ?? null);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const result = await query(`UPDATE courses SET ${assignments} WHERE id = $${fields.length + 1} RETURNING *`, [...values, id]);
    if (!result.rows[0]) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: 'No se pudieron guardar los datos del DNC.' }, { status: 500 });
  }
}

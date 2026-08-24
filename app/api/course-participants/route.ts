import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { course_id, employee_id } = body;

    if (!course_id || !employee_id) {
      return NextResponse.json({ error: 'Faltan parámetros (course_id, employee_id)' }, { status: 400 });
    }

    await client.query('BEGIN');

    const cpRes = await client.query(
      `INSERT INTO course_participants (course_id, employee_id)
       VALUES ($1, $2)
       RETURNING *`,
      [course_id, employee_id]
    );

    const participant = cpRes.rows[0];

    const qRes = await client.query(
      `INSERT INTO questionnaires (course_participant_id, course_id, employee_id, type, status)
       VALUES ($1, $2, $3, 'hot', 'pending')
       RETURNING id`,
      [participant.id, course_id, employee_id]
    );

    const qId = qRes.rows[0]?.id;
    if (qId) {
      await client.query(
        `INSERT INTO questionnaire_responses (questionnaire_id, question_key, section, question_text, response_type)
         VALUES 
         ($1, 'q1', 'evaluacion', 'Dominio del tema por el instructor', 'scale'),
         ($1, 'q2', 'evaluacion', 'Claridad de las explicaciones', 'scale'),
         ($1, 'q3', 'evaluacion', 'Utilidad del material didáctico', 'scale'),
         ($1, 'q4', 'evaluacion', 'Cumplimiento de los objetivos del curso', 'scale'),
         ($1, 'q5', 'evaluacion', 'Instalaciones y equipo utilizado', 'scale')`,
        [qId]
      );
    }

    const userPlantRes = await client.query(`SELECT plant_id FROM user_plants WHERE user_id = $1 LIMIT 1`, [session.user.id]);
    const plantId = userPlantRes.rows[0]?.plant_id;

    if (plantId) {
      await client.query(
        `INSERT INTO dnc_entries (course_participant_id, plant_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [participant.id, plantId]
      );
    }

    const courseRes = await client.query(`SELECT deteccion_id FROM courses WHERE id = $1`, [course_id]);
    if (courseRes.rows[0]?.deteccion_id) {
      await client.query(
        `INSERT INTO deteccion_empleados (deteccion_id, employee_id, color, status)
         VALUES ($1, $2, '#ef4444', 'no_tomado')
         ON CONFLICT (deteccion_id, employee_id) DO NOTHING`,
        [courseRes.rows[0].deteccion_id, employee_id]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ data: participant });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este empleado ya está inscrito en el curso', code: '23505' }, { status: 400 });
    }
    console.error('[api/course-participants] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error al agregar participante' }, { status: 500 });
  } finally {
    client.release();
  }
}

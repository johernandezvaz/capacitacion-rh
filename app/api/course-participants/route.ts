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
       ON CONFLICT (course_participant_id, type) DO NOTHING
       RETURNING id`,
      [participant.id, course_id, employee_id]
    );

    const qId = qRes.rows[0]?.id;
    if (qId) {
      await client.query(
        `INSERT INTO questionnaire_responses (questionnaire_id, question_key, section, question_text, response_type)
         VALUES 
         ($1, 'q1', 'evaluation', 'Dominio del tema por el instructor', 'percentage'),
         ($1, 'q2', 'evaluation', 'Claridad de las explicaciones', 'percentage'),
         ($1, 'q3', 'evaluation', 'Utilidad del material didáctico', 'percentage'),
         ($1, 'q4', 'evaluation', 'Cumplimiento de los objetivos del curso', 'percentage'),
         ($1, 'q5', 'evaluation', 'Instalaciones y equipo utilizado', 'percentage'),
         ($1, 'content_transferable', 'feedback', '¿El contenido es transferible a la práctica diaria?', 'yes_no'),
         ($1, 'has_problems', 'feedback', '¿Hay algún problema que deba abordarse?', 'yes_no'),
         ($1, 'problems_detail', 'feedback', 'Descripción del problema', 'text'),
         ($1, 'met_expectations', 'feedback', '¿La capacitación brindada cumplió con sus expectativas?', 'yes_no')`,
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

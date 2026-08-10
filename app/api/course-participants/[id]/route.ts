import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const { id: participantId } = await params;

    const cpRes = await client.query(
      `SELECT course_id, employee_id FROM course_participants WHERE id = $1`,
      [participantId]
    );

    if (cpRes.rowCount === 0) {
      return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 });
    }

    const { course_id, employee_id } = cpRes.rows[0];

    await client.query('BEGIN');

    const qRes = await client.query(`SELECT id FROM questionnaires WHERE course_participant_id = $1`, [participantId]);
    const qIds = qRes.rows.map(r => r.id);

    if (qIds.length > 0) {
      await client.query(`DELETE FROM questionnaire_signatures WHERE questionnaire_id = ANY($1::uuid[])`, [qIds]);
      await client.query(`DELETE FROM questionnaire_responses WHERE questionnaire_id = ANY($1::uuid[])`, [qIds]);
      await client.query(`DELETE FROM questionnaires WHERE course_participant_id = $1`, [participantId]);
    }

    await client.query(`DELETE FROM course_participants WHERE id = $1`, [participantId]);

    const courseRes = await client.query(`SELECT deteccion_id FROM courses WHERE id = $1`, [course_id]);
    if (courseRes.rows[0]?.deteccion_id) {
      await client.query(
        `DELETE FROM deteccion_empleados WHERE deteccion_id = $1 AND employee_id = $2`,
        [courseRes.rows[0].deteccion_id, employee_id]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[api/course-participants/[id]] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar participante' }, { status: 500 });
  } finally {
    client.release();
  }
}

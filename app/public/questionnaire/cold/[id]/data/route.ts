import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const questionnaireId = resolvedParams.id;

        const qRes = await pool.query(
            `SELECT q.id, q.course_participant_id, q.status, q.submitted_at, q.available_from, q.average_score, q.observation_1,
                    cp.id AS cp_id, cp.course_id,
                    c.name AS course_name, c.start_date AS course_start_date, c.duration_hours AS course_duration_hours,
                    e.nombre AS emp_nombre, e.employee_number AS emp_number, e.puesto AS emp_puesto, e.area AS emp_area
             FROM questionnaires q
             JOIN course_participants cp ON q.course_participant_id = cp.id
             JOIN courses c ON cp.course_id = c.id
             JOIN employees e ON cp.employee_id = e.id
             WHERE q.id = $1 AND q.type = 'cold'`,
            [questionnaireId]
        );

        if (qRes.rowCount === 0) {
            return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 });
        }

        const row = qRes.rows[0];
        const questionnaire = {
            id: row.id,
            course_participant_id: row.course_participant_id,
            status: row.status,
            submitted_at: row.submitted_at,
            available_from: row.available_from,
            average_score: row.average_score != null ? Number(row.average_score) : null,
            observation_1: row.observation_1,
            course_participant: {
                id: row.cp_id,
                course_id: row.course_id,
                course: {
                    name: row.course_name,
                    start_date: row.course_start_date,
                    duration_hours: row.course_duration_hours != null ? Number(row.course_duration_hours) : 0,
                },
                employee: {
                    nombre: row.emp_nombre,
                    employee_number: row.emp_number,
                    puesto: row.emp_puesto,
                    area: row.emp_area,
                },
            },
        };

        const [rRes, sRes] = await Promise.all([
            pool.query(
                `SELECT * FROM questionnaire_responses WHERE questionnaire_id = $1 ORDER BY question_key ASC`,
                [questionnaireId]
            ),
            pool.query(
                `SELECT * FROM questionnaire_signatures WHERE questionnaire_id = $1 ORDER BY signed_at ASC`,
                [questionnaireId]
            ),
        ]);

        const responses = rRes.rows.map(r => ({
            ...r,
            percentage_value: r.percentage_value != null ? Number(r.percentage_value) : null,
        }));

        return NextResponse.json({
            questionnaire,
            responses,
            signatures: sRes.rows,
        });
    } catch (error: any) {
        console.error('Error in GET /public/questionnaire/cold/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener el cuestionario' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const questionnaireId = resolvedParams.id;
        const body = await request.json();

        const { action } = body;

        if (action === 'update_response') {
            const { question_key, value } = body;
            await pool.query(
                `UPDATE questionnaire_responses
                 SET percentage_value = $1, updated_at = NOW()
                 WHERE questionnaire_id = $2 AND question_key = $3`,
                [value != null ? Number(value) : null, questionnaireId, question_key]
            );
            return NextResponse.json({ success: true });
        }

        if (action === 'update_observations') {
            const { observation_1 } = body;
            await pool.query(
                `UPDATE questionnaires
                 SET observation_1 = $1
                 WHERE id = $2`,
                [observation_1 || '', questionnaireId]
            );
            return NextResponse.json({ success: true });
        }

        if (action === 'sign_evaluator') {
            const { signer_name, average_score, observation_1 } = body;

            await pool.query(
                `UPDATE questionnaires
                 SET average_score = $1, observation_1 = $2
                 WHERE id = $3`,
                [average_score != null ? Number(average_score) : null, String(observation_1 || '').trim(), questionnaireId]
            );

            await pool.query(
                `INSERT INTO questionnaire_signatures (questionnaire_id, signer_type, signer_name)
                 VALUES ($1, 'evaluator', $2)`,
                [questionnaireId, String(signer_name).trim()]
            );

            await pool.query(
                `UPDATE questionnaires
                 SET status = 'completed', submitted_at = NOW()
                 WHERE id = $1`,
                [questionnaireId]
            );

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in PATCH /public/questionnaire/cold/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al actualizar el cuestionario' },
            { status: 500 }
        );
    }
}

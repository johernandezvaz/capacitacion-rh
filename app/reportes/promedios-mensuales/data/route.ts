import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');
        const yearStr = searchParams.get('year');
        const monthStr = searchParams.get('month');
        const type = searchParams.get('type') || 'hot';

        if (!plantId || !yearStr || !monthStr) {
            return NextResponse.json({
                detalle: [],
                promedioPlanta: null,
            });
        }

        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        const [detalleRes, plantaRes] = await Promise.all([
            pool.query(
                `SELECT 
                    e.id AS employee_id,
                    e.nombre AS employee_name,
                    c.id AS course_id,
                    c.name AS course_name,
                    q.average_score AS promedio_curso
                 FROM questionnaires q
                 JOIN course_participants cp ON q.course_participant_id = cp.id
                 JOIN courses c ON cp.course_id = c.id
                 JOIN employees e ON cp.employee_id = e.id
                 WHERE q.type = $1
                   AND (e.plant_id = $2 OR c.plant_id = $2)
                   AND q.status = 'completed'
                   AND q.submitted_at IS NOT NULL
                   AND EXTRACT(YEAR FROM q.submitted_at) = $3
                   AND EXTRACT(MONTH FROM q.submitted_at) = $4
                 ORDER BY e.nombre ASC, c.name ASC`,
                [type, plantId, year, month]
            ),
            pool.query(
                `SELECT 
                    COALESCE(AVG(q.average_score), 0) AS promedio_planta,
                    COUNT(q.id)::int AS num_evaluaciones,
                    COUNT(DISTINCT cp.employee_id)::int AS num_empleados
                 FROM questionnaires q
                 JOIN course_participants cp ON q.course_participant_id = cp.id
                 JOIN courses c ON cp.course_id = c.id
                 JOIN employees e ON cp.employee_id = e.id
                 WHERE q.type = $1
                   AND (e.plant_id = $2 OR c.plant_id = $2)
                   AND q.status = 'completed'
                   AND q.submitted_at IS NOT NULL
                   AND EXTRACT(YEAR FROM q.submitted_at) = $3
                   AND EXTRACT(MONTH FROM q.submitted_at) = $4`,
                [type, plantId, year, month]
            ),
        ]);

        const detalle = detalleRes.rows.map(r => ({
            ...r,
            promedio_curso: r.promedio_curso != null ? Number(r.promedio_curso) : 0,
        }));

        const rawPlanta = plantaRes.rows[0];
        const promedioPlanta = rawPlanta ? {
            promedio_planta: Number(rawPlanta.promedio_planta || 0),
            num_evaluaciones: Number(rawPlanta.num_evaluaciones || 0),
            num_empleados: Number(rawPlanta.num_empleados || 0),
        } : null;

        return NextResponse.json({
            detalle,
            promedioPlanta,
        });
    } catch (error: any) {
        console.error('Error in GET /reportes/promedios-mensuales/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener promedios mensuales' },
            { status: 500 }
        );
    }
}

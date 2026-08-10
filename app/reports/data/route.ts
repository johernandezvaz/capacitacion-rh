import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');
        const yearId = searchParams.get('year_id');

        if (!plantId || !yearId) {
            return NextResponse.json({
                courses: [],
                reportStatuses: {},
            });
        }

        const res = await pool.query(
            `SELECT 
                c.id, c.name, c.date, c.year_id, ty.year,
                COUNT(DISTINCT cp.id)::int AS total_participants,
                COUNT(DISTINCT CASE WHEN q.type = 'hot' AND q.status = 'completed' AND q.submitted_at IS NOT NULL THEN cp.id END)::int AS completed_hot,
                COUNT(DISTINCT CASE WHEN q.type = 'cold' AND q.status = 'completed' AND q.submitted_at IS NOT NULL THEN cp.id END)::int AS completed_cold
             FROM courses c
             JOIN training_years ty ON c.year_id = ty.id
             LEFT JOIN course_participants cp ON cp.course_id = c.id
             LEFT JOIN questionnaires q ON q.course_participant_id = cp.id
             WHERE c.plant_id = $1 AND c.year_id = $2
             GROUP BY c.id, ty.year
             ORDER BY c.date DESC`,
            [plantId, yearId]
        );

        const courses: any[] = [];
        const reportStatuses: Record<string, any> = {};

        for (const row of res.rows) {
            courses.push({
                id: row.id,
                name: row.name,
                date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
                year_id: row.year_id,
                year: { year: Number(row.year) },
            });

            const totalParticipants = Number(row.total_participants || 0);
            const completedHot = Number(row.completed_hot || 0);
            const completedCold = Number(row.completed_cold || 0);

            if (totalParticipants === 0) {
                reportStatuses[row.id] = {
                    courseId: row.id,
                    hotReportAvailable: false,
                    coldReportAvailable: false,
                    hotReportMessage: 'No hay participantes inscritos',
                    coldReportMessage: 'No hay participantes inscritos',
                    totalParticipants: 0,
                    completedHot: 0,
                    completedCold: 0,
                };
            } else {
                const hotReportAvailable = completedHot === totalParticipants;
                const coldReportAvailable = totalParticipants > 0;

                let hotReportMessage = '';
                let coldReportMessage = '';

                if (!hotReportAvailable) {
                    const pending = totalParticipants - completedHot;
                    hotReportMessage = `${pending} participante${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de completar cuestionario empleado`;
                } else {
                    hotReportMessage = 'Disponible';
                }

                if (completedCold === totalParticipants) {
                    coldReportMessage = 'Disponible';
                } else if (completedCold === 0) {
                    coldReportMessage = 'Sin cuestionarios completados aún';
                } else {
                    coldReportMessage = `${completedCold} de ${totalParticipants} evaluador${totalParticipants !== 1 ? 'es' : ''} completado${completedCold !== 1 ? 's' : ''}`;
                }

                reportStatuses[row.id] = {
                    courseId: row.id,
                    hotReportAvailable,
                    coldReportAvailable,
                    hotReportMessage,
                    coldReportMessage,
                    totalParticipants,
                    completedHot,
                    completedCold,
                };
            }
        }

        return NextResponse.json({
            courses,
            reportStatuses,
        });
    } catch (error: any) {
        console.error('Error in GET /reports/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener reportes de cursos' },
            { status: 500 }
        );
    }
}

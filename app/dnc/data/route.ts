import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');
        const yearId = searchParams.get('year_id');

        if (!plantId || !yearId) {
            return NextResponse.json({ courses: [], detecciones: [] });
        }

        const coursesRes = await pool.query(
            `SELECT id, name, date, start_date, end_date, fecha_programada, fecha_real, comentario_dnc, deteccion_id, dnc_status, dnc_comentario
             FROM courses
             WHERE plant_id = $1 AND year_id = $2`,
            [plantId, yearId]
        );

        const coursesData = coursesRes.rows;
        const courseIds = coursesData.map(c => c.id);

        let cursosFiltrados = coursesData;

        if (courseIds.length > 0) {
            const participantsRes = await pool.query(
                `SELECT cp.course_id, e.es_baja
                 FROM course_participants cp
                 JOIN employees e ON cp.employee_id = e.id
                 WHERE cp.course_id = ANY($1::uuid[])`,
                [courseIds]
            );
            const participantsData = participantsRes.rows;

            const deteccionIds = coursesData
                .map(c => c.deteccion_id)
                .filter(Boolean);

            let deteccionEmpleadosData: any[] = [];
            if (deteccionIds.length > 0) {
                const deRes = await pool.query(
                    `SELECT de.deteccion_id, e.es_baja
                     FROM deteccion_empleados de
                     JOIN employees e ON de.employee_id = e.id
                     WHERE de.deteccion_id = ANY($1::uuid[])`,
                    [deteccionIds]
                );
                deteccionEmpleadosData = deRes.rows;
            }

            cursosFiltrados = coursesData.filter(c => {
                const participantes = participantsData.filter(p => p.course_id === c.id);

                if (participantes.length > 0) {
                    const todosEnBaja = participantes.every(p => p.es_baja === true);
                    const cursoTomado = !!c.fecha_real;
                    if (todosEnBaja && !cursoTomado) return false;
                    return true;
                }

                if (c.deteccion_id) {
                    const empsDet = deteccionEmpleadosData.filter(de => de.deteccion_id === c.deteccion_id);
                    if (empsDet.length > 0) {
                        const todosEnBaja = empsDet.every(de => de.es_baja === true);
                        const cursoTomado = !!c.fecha_real;
                        if (todosEnBaja && !cursoTomado) return false;
                    }
                }

                return true;
            });
        }

        const detRes = await pool.query(
            `SELECT id, nombre, color, status, fecha_programada, fecha_real, comentario_dnc
             FROM detecciones
             WHERE plant_id = $1 AND year_id = $2`,
            [plantId, yearId]
        );

        return NextResponse.json({
            courses: cursosFiltrados,
            detecciones: detRes.rows,
        });
    } catch (error: any) {
        console.error('Error in GET /dnc/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener datos DNC' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, id, comentario } = body;

        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan parámetros id o type' }, { status: 400 });
        }

        const value = comentario ? String(comentario).trim() || null : null;

        if (type === 'course') {
            await pool.query(
                `UPDATE courses SET dnc_comentario = $1 WHERE id = $2`,
                [value, id]
            );
        } else if (type === 'deteccion') {
            await pool.query(
                `UPDATE detecciones SET comentario_dnc = $1 WHERE id = $2`,
                [value, id]
            );
        } else {
            return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in PATCH /dnc/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al actualizar comentario DNC' },
            { status: 500 }
        );
    }
}

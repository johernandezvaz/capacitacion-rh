import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

function formatDateString(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }
    const str = String(val);
    if (str.includes('T')) {
        return str.split('T')[0];
    }
    return str;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const yearId = resolvedParams.id;
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');

        if (!plantId) {
            return NextResponse.json({ year: null, courses: [], detecciones: [] });
        }

        await pool.query(
            `UPDATE courses
             SET status = 'closed'
             WHERE year_id = $1 AND plant_id = $2 AND status = 'active' AND end_date < CURRENT_DATE`,
            [yearId, plantId]
        );

        const [yearRes, coursesRes, detRes] = await Promise.all([
            pool.query(`SELECT * FROM training_years WHERE id = $1`, [yearId]),
            pool.query(`SELECT * FROM courses WHERE year_id = $1 AND plant_id = $2 ORDER BY date ASC`, [yearId, plantId]),
            pool.query(`SELECT * FROM detecciones ORDER BY nombre ASC`),
        ]);

        if (yearRes.rowCount === 0) {
            return NextResponse.json({ year: null, courses: [], detecciones: [] });
        }

        const year = yearRes.rows[0];
        const courses = coursesRes.rows.map(c => ({
            ...c,
            date: formatDateString(c.date),
            start_date: formatDateString(c.start_date),
            end_date: formatDateString(c.end_date),
            fecha_programada: formatDateString(c.fecha_programada),
            fecha_real: formatDateString(c.fecha_real),
            duration_hours: c.duration_hours != null ? Number(c.duration_hours) : 0,
            costo: c.costo != null ? Number(c.costo) : null,
        }));
        const detecciones = detRes.rows.map(d => ({
            ...d,
            fecha_programada: formatDateString(d.fecha_programada),
            fecha_real: formatDateString(d.fecha_real),
            costo: d.costo != null ? Number(d.costo) : null,
            duration_hours: d.duration_hours != null ? Number(d.duration_hours) : null,
        }));

        return NextResponse.json({
            year,
            courses,
            detecciones,
        });
    } catch (error: any) {
        console.error('Error in GET /year/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener datos del año' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const yearId = resolvedParams.id;
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'delete_year') {
            await pool.query(
                `DELETE FROM course_participants WHERE course_id IN (SELECT id FROM courses WHERE year_id = $1)`,
                [yearId]
            );
            await pool.query(`DELETE FROM courses WHERE year_id = $1`, [yearId]);
            await pool.query(`DELETE FROM training_years WHERE id = $1`, [yearId]);

            return NextResponse.json({ success: true });
        }

        if (action === 'delete_course') {
            const courseId = searchParams.get('course_id');
            if (!courseId) {
                return NextResponse.json({ error: 'course_id requerido' }, { status: 400 });
            }

            await pool.query(`DELETE FROM course_participants WHERE course_id = $1`, [courseId]);
            await pool.query(`DELETE FROM courses WHERE id = $1`, [courseId]);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in DELETE /year/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al eliminar' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { action, course_id, name } = body;

        if (action === 'rename_course') {
            if (!course_id || !name?.trim()) {
                return NextResponse.json({ error: 'course_id y name son requeridos' }, { status: 400 });
            }

            await pool.query(
                `UPDATE courses SET name = $1 WHERE id = $2`,
                [name.trim(), course_id]
            );

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in PATCH /year/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al actualizar el curso' },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');
        const checkCourses = searchParams.get('check_courses');
        const employeeId = searchParams.get('employee_id');

        if (checkCourses === 'true' && employeeId) {
            const res = await pool.query(
                `SELECT id FROM course_participants WHERE employee_id = $1`,
                [employeeId]
            );
            return NextResponse.json({ hasActiveCourses: res.rows.length > 0 });
        }

        if (!plantId) {
            return NextResponse.json({ employees: [] });
        }

        const res = await pool.query(
            `SELECT * FROM employees WHERE plant_id = $1 ORDER BY nombre ASC`,
            [plantId]
        );

        return NextResponse.json({ employees: res.rows });
    } catch (error: any) {
        console.error('Error in GET /employees/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener empleados' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, employee_id, area, es_baja, fecha_baja } = body;

        if (!employee_id) {
            return NextResponse.json({ error: 'Falta employee_id' }, { status: 400 });
        }

        if (action === 'update_area') {
            const res = await pool.query(
                `UPDATE employees SET area = $1 WHERE id = $2 RETURNING *`,
                [area ? String(area).trim() : '', employee_id]
            );
            return NextResponse.json({ employee: res.rows[0] });
        }

        if (action === 'toggle_baja') {
            const res = await pool.query(
                `UPDATE employees SET es_baja = $1, fecha_baja = $2 WHERE id = $3 RETURNING *`,
                [Boolean(es_baja), fecha_baja || null, employee_id]
            );
            return NextResponse.json({ employee: res.rows[0] });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in PATCH /employees/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al actualizar empleado' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Falta parámetro id' }, { status: 400 });
        }

        await pool.query(`DELETE FROM employees WHERE id = $1`, [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DELETE /employees/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al eliminar empleado' },
            { status: 500 }
        );
    }
}

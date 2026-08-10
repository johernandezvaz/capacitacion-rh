import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const employeeId = resolvedParams.id;

        const empRes = await pool.query(
            `SELECT * FROM employees WHERE id = $1`,
            [employeeId]
        );

        if (empRes.rowCount === 0) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        const detRes = await pool.query(
            `SELECT d.id, d.nombre, d.status, d.fecha_programada, d.fecha_real
             FROM deteccion_empleados de
             JOIN detecciones d ON de.deteccion_id = d.id
             WHERE de.employee_id = $1
             ORDER BY d.created_at DESC`,
            [employeeId]
        );

        return NextResponse.json({
            employee: empRes.rows[0],
            detecciones: detRes.rows,
        });
    } catch (error: any) {
        console.error('Error in GET /employees/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener empleado' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const employeeId = resolvedParams.id;
        const body = await request.json();

        const { employee_number, nombre, area, puesto, evaluador } = body;

        const empNum = String(employee_number || '').trim();
        const nom = String(nombre || '').trim();
        const ar = String(area || '').trim();
        const pst = String(puesto || '').trim();
        const ev = String(evaluador || '').trim();

        const checkRes = await pool.query(
            `SELECT id FROM employees WHERE employee_number = $1 AND id != $2`,
            [empNum, employeeId]
        );

        if ((checkRes.rowCount ?? 0) > 0) {
            return NextResponse.json(
                { error: 'Este número de empleado ya existe', code: 'DUPLICATE_NUMBER' },
                { status: 400 }
            );
        }

        const updateRes = await pool.query(
            `UPDATE employees
             SET employee_number = $1, nombre = $2, area = $3, puesto = $4, evaluador = $5
             WHERE id = $6
             RETURNING *`,
            [empNum, nom, ar, pst, ev, employeeId]
        );

        return NextResponse.json({ employee: updateRes.rows[0] });
    } catch (error: any) {
        console.error('Error in PUT /employees/[id]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al actualizar empleado' },
            { status: 500 }
        );
    }
}

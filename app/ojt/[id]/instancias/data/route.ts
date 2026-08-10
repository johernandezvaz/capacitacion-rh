import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const templateId = resolvedParams.id;
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');

        const [tmplRes, instRes, empsRes] = await Promise.all([
            pool.query(`SELECT * FROM ojt_records WHERE id = $1`, [templateId]),
            pool.query(
                `SELECT i.*, e.nombre AS empleado_nombre, e.puesto AS empleado_puesto
                 FROM ojt_instances i
                 LEFT JOIN employees e ON i.employee_id = e.id
                 WHERE i.template_id = $1
                 ORDER BY i.created_at DESC`,
                [templateId]
            ),
            plantId
                ? pool.query(
                    `SELECT id, nombre, puesto, employee_number, area, evaluador, created_at, es_baja, fecha_baja
                     FROM employees
                     WHERE plant_id = $1
                     ORDER BY nombre ASC`,
                    [plantId]
                )
                : Promise.resolve({ rows: [] }),
        ]);

        const instances = instRes.rows.map(i => ({
            ...i,
            average_efectividad: i.average_efectividad != null ? Number(i.average_efectividad) : null,
            es_baja: !!i.es_baja,
        }));

        return NextResponse.json({
            template: tmplRes.rows[0] || null,
            instances,
            employees: empsRes.rows,
        });
    } catch (error: any) {
        console.error('Error in GET /ojt/[id]/instancias/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener instancias OJT' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const templateId = resolvedParams.id;
        const body = await request.json();

        const { employee_id, jefe_directo_id, nombre, fecha_inicio, fecha_termino } = body;

        const instRes = await pool.query(
            `INSERT INTO ojt_instances (template_id, employee_id, jefe_directo_id, nombre, fecha_inicio, fecha_termino, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'draft')
             RETURNING *`,
            [
                templateId,
                employee_id || null,
                jefe_directo_id || null,
                nombre || null,
                fecha_inicio || null,
                fecha_termino || null,
            ]
        );

        const newInstance = instRes.rows[0];

        await pool.query(
            `INSERT INTO ojt_instance_entries (instance_id, entry_id)
             SELECT $1, e.id
             FROM ojt_sections s
             JOIN ojt_entries e ON e.section_id = s.id
             WHERE s.record_id = $2`,
            [newInstance.id, templateId]
        );

        return NextResponse.json({ instance: newInstance });
    } catch (error: any) {
        console.error('Error in POST /ojt/[id]/instancias/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al crear instancia OJT' },
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
        const { action, instance_id, es_baja } = body;

        if (action === 'toggle_baja' && instance_id) {
            const res = await pool.query(
                `UPDATE ojt_instances SET es_baja = $1 WHERE id = $2 RETURNING *`,
                [Boolean(es_baja), instance_id]
            );
            return NextResponse.json({ instance: res.rows[0] });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in PATCH /ojt/[id]/instancias/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al actualizar instancia' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get('instance_id');

        if (!instanceId) {
            return NextResponse.json({ error: 'Falta parámetro instance_id' }, { status: 400 });
        }

        await pool.query(`DELETE FROM ojt_instances WHERE id = $1`, [instanceId]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DELETE /ojt/[id]/instancias/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al eliminar instancia OJT' },
            { status: 500 }
        );
    }
}

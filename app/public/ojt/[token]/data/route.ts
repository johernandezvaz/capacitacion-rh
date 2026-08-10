import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const resolvedParams = await params;
        const token = resolvedParams.token;

        const res = await pool.query(
            `SELECT i.id AS instance_id, i.template_id, r.plant_id
             FROM ojt_instances i
             LEFT JOIN ojt_records r ON i.template_id = r.id
             WHERE i.public_token = $1 OR i.id = $1
             ORDER BY (CASE WHEN i.public_token = $1 THEN 1 ELSE 2 END)
             LIMIT 1`,
            [token]
        );

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
        }

        const row = res.rows[0];
        return NextResponse.json({
            instanceId: row.instance_id,
            templateId: row.template_id,
            plantId: row.plant_id ?? null,
        });
    } catch (error: any) {
        console.error('Error in GET /public/ojt/[token]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener entrenamiento' },
            { status: 500 }
        );
    }
}

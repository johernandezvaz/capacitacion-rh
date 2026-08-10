import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
    try {
        const resolvedParams = await params;
        const templateId = resolvedParams.id;
        const instanceId = resolvedParams.instanceId;

        const tmplRes = await pool.query(
            `SELECT titulo FROM ojt_records WHERE id = $1`,
            [templateId]
        );

        const instRes = await pool.query(
            `SELECT public_token FROM ojt_instances WHERE id = $1`,
            [instanceId]
        );

        let publicToken = instRes.rows[0]?.public_token ?? null;

        if (!publicToken && instRes.rowCount && instRes.rowCount > 0) {
            publicToken = instanceId;
            await pool.query(
                `UPDATE ojt_instances SET public_token = $1 WHERE id = $2`,
                [publicToken, instanceId]
            );
        }

        return NextResponse.json({
            templateTitle: tmplRes.rows[0]?.titulo ?? 'Plantilla',
            publicToken,
        });
    } catch (error: any) {
        console.error('Error in GET /ojt/[id]/instancias/[instanceId]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener datos de la instancia' },
            { status: 500 }
        );
    }
}

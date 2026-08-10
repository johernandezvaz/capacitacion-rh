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
            `SELECT id, type FROM questionnaires WHERE id = $1`,
            [token]
        );

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 });
        }

        const row = res.rows[0];
        return NextResponse.json({
            id: row.id,
            type: row.type,
        });
    } catch (error: any) {
        console.error('Error in GET /public/questionnaire/[token]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener cuestionario' },
            { status: 500 }
        );
    }
}

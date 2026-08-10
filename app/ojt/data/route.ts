import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');

        if (!plantId) {
            return NextResponse.json({ records: [], puestos: [] });
        }

        const recordsRes = await pool.query(
            `SELECT r.id, r.titulo, r.puesto, r.periodo_entrenamiento, r.created_at,
                    (SELECT COUNT(*)::int FROM ojt_instances i WHERE i.template_id = r.id) AS total_instancias
             FROM ojt_records r
             WHERE r.is_template = true AND r.plant_id = $1
             ORDER BY r.puesto ASC, r.titulo ASC`,
            [plantId]
        );

        const puestosRes = await pool.query(
            `SELECT DISTINCT puesto
             FROM ojt_records
             WHERE is_template = true AND plant_id = $1 AND puesto IS NOT NULL AND puesto != ''
             ORDER BY puesto ASC`,
            [plantId]
        );

        const puestos = puestosRes.rows.map(r => r.puesto).filter(Boolean);

        return NextResponse.json({
            records: recordsRes.rows,
            puestos,
        });
    } catch (error: any) {
        console.error('Error in GET /ojt/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener plantillas OJT' },
            { status: 500 }
        );
    }
}

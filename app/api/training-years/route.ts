import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const userPlantRes = await query(
      `SELECT plant_id FROM user_plants WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    );

    const plantId = userPlantRes.rows[0]?.plant_id;
    if (!plantId) {
      return NextResponse.json({ data: [] });
    }

    const res = await query(
      `SELECT 
         ty.id, 
         ty.year, 
         ty.plant_id, 
         ty.created_at,
         COUNT(c.id)::int AS course_count
       FROM training_years ty
       LEFT JOIN courses c ON c.year_id = ty.id
       WHERE ty.plant_id = $1 
       GROUP BY ty.id, ty.year, ty.plant_id, ty.created_at
       ORDER BY ty.year DESC`,
      [plantId]
    );

    return NextResponse.json({ data: res.rows });
  } catch (error: any) {
    console.error('[api/training-years] GET error:', error);
    return NextResponse.json({ error: error.message || 'Error en servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { year } = body;
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : Number(year);

    if (!yearNum || isNaN(yearNum)) {
      return NextResponse.json({ error: 'Año inválido' }, { status: 400 });
    }

    const userPlantRes = await query(
      `SELECT plant_id, role FROM user_plants WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    );

    const plantId = userPlantRes.rows[0]?.plant_id;
    const role = userPlantRes.rows[0]?.role;

    if (!plantId) {
      return NextResponse.json({ error: 'Usuario no asignado a ninguna planta' }, { status: 400 });
    }

    if (role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado para crear años' }, { status: 403 });
    }

    const res = await query(
      `INSERT INTO training_years (year, plant_id)
       VALUES ($1, $2)
       RETURNING id, year, plant_id, created_at`,
      [yearNum, plantId]
    );

    return NextResponse.json({ data: { ...res.rows[0], course_count: 0 } });
  } catch (error: any) {
    console.error('[api/training-years] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error al crear año de capacitación' }, { status: 500 });
  }
}

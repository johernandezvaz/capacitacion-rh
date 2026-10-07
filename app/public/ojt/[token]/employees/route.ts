import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { resolvePublicOjtToken } from '@/lib/public-ojt';


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const ctx = await resolvePublicOjtToken(token);
    if (!ctx) {
      return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
    }
    if (!ctx.plantId) {
      return NextResponse.json({ employees: [] });
    }

    const res = await pool.query(
      `SELECT id, employee_number, nombre, puesto, plant_id
       FROM employees
       WHERE plant_id = $1
       ORDER BY nombre ASC`,
      [ctx.plantId]
    );

    return NextResponse.json({ employees: res.rows });
  } catch (error: any) {
    console.error('Error in GET /public/ojt/[token]/employees:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

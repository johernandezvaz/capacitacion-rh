import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, date, duration_hours } = body;

    const userPlantRes = await query(
      `SELECT role FROM user_plants WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    );

    if (userPlantRes.rows[0]?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (date !== undefined) {
      updates.push(`date = $${idx++}`);
      values.push(date);
    }
    if (duration_hours !== undefined) {
      updates.push(`duration_hours = $${idx++}`);
      values.push(duration_hours);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
    }

    values.push(id);
    const sql = `UPDATE courses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await query(sql, values);

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: res.rows[0] });
  } catch (error: any) {
    console.error('[api/courses/[id]] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar curso' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const userPlantRes = await query(
      `SELECT role FROM user_plants WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    );

    if (userPlantRes.rows[0]?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await query(`DELETE FROM courses WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/courses/[id]] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar curso' }, { status: 500 });
  }
}

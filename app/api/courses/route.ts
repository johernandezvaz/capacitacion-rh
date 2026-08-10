import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const userPlantRes = await query(
      `SELECT plant_id, role FROM user_plants WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    );

    const plantId = userPlantRes.rows[0]?.plant_id;
    const role = userPlantRes.rows[0]?.role;

    if (!plantId) {
      return NextResponse.json({ error: 'Usuario sin planta asignada' }, { status: 400 });
    }

    if (role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado para crear cursos' }, { status: 403 });
    }

    const body = await request.json();
    const {
      year_id,
      name,
      date,
      start_date,
      end_date,
      duration_hours,
      inst_interno,
      inst_externo,
      proveedor_sugerido,
      costo,
      fecha_programada,
      fecha_real,
      desarrollo_personal,
      habilidades_blandas,
      prevencion_riesgos,
      habilidades_tecnicas,
      comentario_dnc,
      deteccion_id,
    } = body;

    if (!name || !year_id || !duration_hours) {
      return NextResponse.json({ error: 'Faltan datos requeridos (nombre, año, duración)' }, { status: 400 });
    }

    const courseRes = await query(
      `INSERT INTO courses (
        year_id, name, date, start_date, end_date, duration_hours, status, plant_id,
        inst_interno, inst_externo, proveedor_sugerido, costo, fecha_programada, fecha_real,
        desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas,
        comentario_dnc, deteccion_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'active', $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19
      ) RETURNING *`,
      [
        year_id,
        name.trim(),
        date || start_date || new Date().toISOString().split('T')[0],
        start_date || null,
        end_date || null,
        duration_hours,
        plantId,
        !!inst_interno,
        !!inst_externo,
        proveedor_sugerido ? proveedor_sugerido.trim() : null,
        costo != null ? parseFloat(costo) : null,
        fecha_programada || null,
        fecha_real || null,
        !!desarrollo_personal,
        !!habilidades_blandas,
        !!prevencion_riesgos,
        !!habilidades_tecnicas,
        comentario_dnc ? comentario_dnc.trim() : null,
        deteccion_id || null,
      ]
    );

    let insertedCourse = courseRes.rows[0];

    if (insertedCourse?.id && !deteccion_id) {
      const detRes = await query(
        `INSERT INTO detecciones (
          nombre, plant_id, year_id, color, status, inst_interno, inst_externo,
          proveedor_sugerido, costo, desarrollo_personal, habilidades_blandas,
          prevencion_riesgos, habilidades_tecnicas, fecha_programada, fecha_real, duration_hours
        ) VALUES (
          $1, $2, $3, '#ef4444', 'no_tomado', $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14
        ) RETURNING id`,
        [
          name.trim(),
          plantId,
          year_id,
          !!inst_interno,
          !!inst_externo,
          proveedor_sugerido ? proveedor_sugerido.trim() : null,
          costo != null ? parseFloat(costo) : null,
          !!desarrollo_personal,
          !!habilidades_blandas,
          !!prevencion_riesgos,
          !!habilidades_tecnicas,
          fecha_programada || null,
          fecha_real || null,
          duration_hours || null,
        ]
      );

      if (detRes.rows[0]?.id) {
        await query(
          `UPDATE courses SET deteccion_id = $1 WHERE id = $2`,
          [detRes.rows[0].id, insertedCourse.id]
        );
        insertedCourse.deteccion_id = detRes.rows[0].id;
      }
    }

    return NextResponse.json({ data: insertedCourse });
  } catch (error: any) {
    console.error('[api/courses] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error al crear curso' }, { status: 500 });
  }
}

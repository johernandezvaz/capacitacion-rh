import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { getSessionFromRequest } from '@/lib/auth';
import {
  authorizeInstanceAccess,
  getSafeFirmasPath,
} from '@/lib/firmas';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string; category: string; filename: string }> }
) {
  try {
    const { instanceId, category, filename } = await params;

    if (!instanceId || !category || !filename) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    const instanceRes = await query(
      `SELECT id FROM ojt_instances WHERE id = $1`,
      [instanceId]
    );
    if (!instanceRes.rowCount || instanceRes.rowCount === 0) {
      return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
    }

    const session = await getSessionFromRequest(request);
    if (session) {
      const hasAccess = await authorizeInstanceAccess(session, instanceId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No tiene autorización para acceder a las firmas de esta instancia' },
          { status: 403 }
        );
      }
    }

    const safePath = getSafeFirmasPath(instanceId, category, filename);

    try {
      await fs.stat(safePath);
    } catch {
      return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 });
    }

    const buffer = await fs.readFile(safePath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[api/firmas/get] GET error:', error);
    return NextResponse.json({ error: 'Error al obtener la firma' }, { status: 500 });
  }
}

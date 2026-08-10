import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSessionFromRequest } from '@/lib/auth';
import {
  authorizeInstanceAccess,
  getSafeFirmasPath,
  resolveSignaturePathInfo,
} from '@/lib/firmas';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { dataUrl, instanceId, fieldKey, category: categoryInput, filename: filenameInput } = body;

    if (!instanceId || typeof instanceId !== 'string') {
      return NextResponse.json({ error: 'ID de instancia no válido' }, { status: 400 });
    }

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'La firma debe ser una imagen PNG en formato Base64 Data URL' }, { status: 400 });
    }

    const hasAccess = await authorizeInstanceAccess(session, instanceId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tiene autorización para modificar esta instancia OJT' }, { status: 403 });
    }

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'La firma excede el tamaño máximo permitido de 5MB' }, { status: 400 });
    }

    const { category, filename } = resolveSignaturePathInfo(fieldKey || '', categoryInput, filenameInput);

    const safeDir = getSafeFirmasPath(instanceId, category);
    const safePath = getSafeFirmasPath(instanceId, category, filename);

    await fs.mkdir(safeDir, { recursive: true });
    await fs.writeFile(safePath, buffer);

    const internalUrl = `/api/firmas/${instanceId}/${category}/${filename}`;

    return NextResponse.json({
      success: true,
      url: internalUrl,
    });
  } catch (error: any) {
    console.error('[api/firmas] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar la firma' }, { status: 500 });
  }
}

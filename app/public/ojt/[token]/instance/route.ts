import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicOjtToken } from '@/lib/public-ojt';
import {
  GET as getInstance,
  PATCH as patchInstance,
} from '@/app/api/ojt/instances/[instanceId]/route';

type Params = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const ctx = await resolvePublicOjtToken(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
  }
  return getInstance(request, { params: Promise.resolve({ instanceId: ctx.instanceId }) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const ctx = await resolvePublicOjtToken(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
  }
  return patchInstance(request, { params: Promise.resolve({ instanceId: ctx.instanceId }) });
}

import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicOjtToken } from '@/lib/public-ojt';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const resolvedParams = await params;
        const ctx = await resolvePublicOjtToken(resolvedParams.token);

        if (!ctx) {
            return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 });
        }

        return NextResponse.json(ctx);
    } catch (error: any) {
        console.error('Error in GET /public/ojt/[token]/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener entrenamiento' },
            { status: 500 }
        );
    }
}

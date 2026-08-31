import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const results: string[] = [];

    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false NOT NULL;
    `);
    results.push('Columna force_password_change verificada/creada en users.');

    await query(`
      CREATE TABLE IF NOT EXISTS public.sessions (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    results.push('Tabla sessions verificada/creada.');

    await query(`
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions (expires_at);
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions (user_id);
    `);
    results.push('Índices de sessions verificados/creados.');

    return NextResponse.json({
      success: true,
      message: 'Migración ejecutada con éxito en la base de datos del servidor.',
      results,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al ejecutar migración',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

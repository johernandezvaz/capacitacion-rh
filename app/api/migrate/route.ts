import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const results: string[] = [];

    // 1. Obtener información de la base de datos a la que está conectado este servidor
    const dbInfoResult = await query(`
      SELECT 
        current_database() AS database,
        current_user AS user,
        inet_server_addr() AS server_ip,
        inet_server_port() AS server_port,
        version() AS version
    `);
    const dbInfo = dbInfoResult.rows[0];

    // 2. Agregar columna force_password_change en users si no existe
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false NOT NULL;
    `);
    results.push('Columna force_password_change verificada/creada en users.');

    // 3. Crear tabla sessions si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS public.sessions (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    results.push('Tabla sessions verificada/creada.');

    // 4. Crear índices para sessions si no existen
    await query(`
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions (expires_at);
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions (user_id);
    `);
    results.push('Índices de sessions verificados/creados.');

    // 5. Verificar columnas de users
    const usersColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);

    return NextResponse.json({
      success: true,
      message: 'Migración ejecutada con éxito.',
      database_connection: {
        database: dbInfo.database,
        user: dbInfo.user,
        server_ip: dbInfo.server_ip || 'localhost / socket',
        server_port: dbInfo.server_port || 5432,
        version: dbInfo.version,
      },
      results,
      users_columns: usersColumns.rows,
    });
  } catch (error: any) {
    console.error('Migration/DB info error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al consultar BD / ejecutar migración',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

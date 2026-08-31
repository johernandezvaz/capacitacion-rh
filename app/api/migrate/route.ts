import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const stepsReport: { step: string; status: 'ok' | 'error'; message?: string }[] = [];
  let dbInfo: any = {};
  let usersColumns: any[] = [];
  let sessionsColumns: any[] = [];

  // 1. Información de conexión a la BD
  try {
    const dbInfoResult = await query(`
      SELECT 
        current_database() AS database,
        current_user AS user,
        inet_server_addr() AS server_ip,
        inet_server_port() AS server_port,
        version() AS version
    `);
    dbInfo = dbInfoResult.rows[0] || {};
    stepsReport.push({ step: '1. Conexión a BD', status: 'ok', message: `Conectado a ${dbInfo.database}` });
  } catch (err: any) {
    stepsReport.push({ step: '1. Conexión a BD', status: 'error', message: err.message });
  }

  // 2. Inspeccionar tipo de users.id y columnas de users
  let userIdType = 'uuid';
  try {
    const colsRes = await query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    usersColumns = colsRes.rows;
    const idCol = usersColumns.find((c) => c.column_name === 'id');
    if (idCol) {
      userIdType = idCol.udt_name || idCol.data_type || 'uuid';
    }
    stepsReport.push({
      step: '2. Inspección tabla users',
      status: 'ok',
      message: `users.id es de tipo: ${userIdType}`,
    });
  } catch (err: any) {
    stepsReport.push({ step: '2. Inspección tabla users', status: 'error', message: err.message });
  }

  // 3. Agregar columna force_password_change a users si no existe
  try {
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false NOT NULL;
    `);
    stepsReport.push({
      step: '3. Columna force_password_change',
      status: 'ok',
      message: 'Columna agregada o ya existente.',
    });
  } catch (err: any) {
    stepsReport.push({ step: '3. Columna force_password_change', status: 'error', message: err.message });
  }

  // 4. Crear tabla sessions adaptada al tipo de users.id
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.sessions (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        user_id ${userIdType} NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    stepsReport.push({
      step: '4. Crear tabla sessions',
      status: 'ok',
      message: `Tabla sessions creada o existente con user_id ${userIdType}.`,
    });
  } catch (err: any) {
    stepsReport.push({ step: '4. Crear tabla sessions', status: 'error', message: err.message });
  }

  // 5. Crear índices para sessions
  try {
    await query(`
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions (expires_at);
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions (user_id);
    `);
    stepsReport.push({ step: '5. Índices de sessions', status: 'ok', message: 'Índices creados o existentes.' });
  } catch (err: any) {
    stepsReport.push({ step: '5. Índices de sessions', status: 'error', message: err.message });
  }

  // 6. Columnas actuales de sessions
  try {
    const sCols = await query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions'
    `);
    sessionsColumns = sCols.rows;
  } catch {}

  // 7. Columnas actualizadas de users
  try {
    const uCols = await query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    usersColumns = uCols.rows;
  } catch {}

  return NextResponse.json({
    database_info: {
      database_name: dbInfo.database,
      db_user: dbInfo.user,
      server_ip: dbInfo.server_ip || 'localhost / unix socket',
      server_port: dbInfo.server_port || 5432,
      postgres_version: dbInfo.version,
    },
    steps_report: stepsReport,
    users_columns: usersColumns,
    sessions_columns: sessionsColumns,
  });
}

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const SESSION_COOKIE_NAME = 'capacitacion_session';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
type SessionRow = { session_id: string; expires_at: Date; user_id: string; email: string; password_hash: string; force_password_change: boolean };
export type AuthenticatedSession = { id: string; expiresAt: Date; user: { id: string; email: string; passwordHash: string; forcePasswordChange: boolean } };

function toSession(row: SessionRow): AuthenticatedSession { return { id: row.session_id, expiresAt: row.expires_at, user: { id: row.user_id, email: row.email, passwordHash: row.password_hash, forcePasswordChange: row.force_password_change } }; }
export async function getSessionById(sessionId?: string): Promise<AuthenticatedSession | null> {
  if (!sessionId) return null;
  const result = await query<SessionRow>(`SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.email, u.password_hash, u.force_password_change FROM sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now()`, [sessionId]);
  return result.rows[0] ? toSession(result.rows[0]) : null;
}
export async function getSessionFromRequest(request: NextRequest | Request) { const cookieHeader = request.headers.get('cookie') || ''; const sessionId = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))?.slice(SESSION_COOKIE_NAME.length + 1); return getSessionById(sessionId); }
export async function getServerSession() { const cookieStore = await cookies(); return getSessionById(cookieStore.get(SESSION_COOKIE_NAME)?.value); }
export function sessionCookieOptions(expiresAt: Date) { return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires: expiresAt }; }

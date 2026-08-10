import { NextResponse } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE_NAME } from '@/lib/auth';
import { query } from '@/lib/db';
export async function POST(request: Request) { const session = await getSessionFromRequest(request); if (session) await query('DELETE FROM sessions WHERE id = $1', [session.id]); const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 }); return response; }

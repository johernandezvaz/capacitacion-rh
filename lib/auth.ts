import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const SESSION_COOKIE_NAME = 'capacitacion_session';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type SessionRow = {
  session_id: string;
  expires_at: Date;
  user_id: string;
  email: string;
  password_hash: string;
  force_password_change: boolean;
};

export type AuthenticatedSession = {
  id: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    passwordHash: string;
    forcePasswordChange: boolean;
  };
};

const SECRET_KEY = process.env.SESSION_SECRET || 'capacitacion-rh-secret-key-2026';

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(session: AuthenticatedSession): Promise<string> {
  const payload = JSON.stringify({
    id: session.id,
    expiresAt: session.expiresAt.getTime(),
    user: session.user,
  });
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payload);
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getCryptoKey();
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token?: string): Promise<AuthenticatedSession | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await getCryptoKey();
    const enc = new TextEncoder();
    const sigBytes = base64UrlDecode(sigB64);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as BufferSource, enc.encode(payloadB64));
    if (!isValid) return null;

    const payloadBytes = base64UrlDecode(payloadB64);
    const dec = new TextDecoder();
    const data = JSON.parse(dec.decode(payloadBytes));

    const expiresAt = new Date(data.expiresAt);
    if (expiresAt.getTime() <= Date.now()) return null;

    return {
      id: data.id,
      expiresAt,
      user: data.user,
    };
  } catch {
    return null;
  }
}

function toSession(row: SessionRow): AuthenticatedSession {
  return {
    id: row.session_id,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      email: row.email,
      passwordHash: row.password_hash,
      forcePasswordChange: row.force_password_change,
    },
  };
}

export async function getSessionById(sessionId?: string): Promise<AuthenticatedSession | null> {
  if (!sessionId) return null;

  const tokenSession = await verifySessionToken(sessionId);
  if (tokenSession) return tokenSession;

  try {
    const result = await query<SessionRow>(
      `SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.email, u.password_hash, u.force_password_change 
       FROM sessions s 
       INNER JOIN users u ON u.id = s.user_id 
       WHERE s.id = $1 AND s.expires_at > now()`,
      [sessionId]
    );
    return result.rows[0] ? toSession(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest | Request): Promise<AuthenticatedSession | null> {
  let token: string | undefined;
  if ('cookies' in request && typeof (request as NextRequest).cookies?.get === 'function') {
    token = (request as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    const cookieHeader = request.headers.get('cookie') || '';
    token = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);
  }
  if (!token) return null;

  const sessionFromToken = await verifySessionToken(token);
  if (sessionFromToken) return sessionFromToken;

  return getSessionById(token);
}

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionFromRequest({
    headers: new Headers({
      cookie: `${SESSION_COOKIE_NAME}=${token || ''}`,
    }),
  } as any);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

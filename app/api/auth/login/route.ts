import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import {
  SESSION_DURATION_MS,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  createSessionToken,
  AuthenticatedSession,
} from '@/lib/auth';
import { query } from '@/lib/db';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  force_password_change: boolean;
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Credenciales incorrectas.' }, { status: 401 });
    }

    const userResult = await query<UserRow>(
      'SELECT id, email, password_hash, force_password_change FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = userResult.rows[0];
    const passwordMatches =
      user && typeof user.password_hash === 'string' && user.password_hash.length > 0
        ? await bcrypt.compare(password, user.password_hash)
        : false;

    if (!user || !passwordMatches) {
      return NextResponse.json({ error: 'Credenciales incorrectas.' }, { status: 401 });
    }

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const sessionResult = await query<{ id: string }>(
      'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id',
      [user.id, expiresAt]
    );

    const sessionObj: AuthenticatedSession = {
      id: sessionResult.rows[0].id,
      expiresAt,
      user: {
        id: String(user.id),
        email: user.email,
        passwordHash: user.password_hash,
        forcePasswordChange: user.force_password_change,
      },
    };

    const token = await createSessionToken(sessionObj);
    const response = NextResponse.json({ force_password_change: user.force_password_change });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: 'No fue posible iniciar sesión.',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

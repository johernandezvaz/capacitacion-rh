import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      force_password_change: session.user.forcePasswordChange,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/change-password',
  '/api/migrate',
  '/api/db-info',
]);
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/public') || AUTH_PATHS.has(pathname)) return NextResponse.next();
  const session = await getSessionFromRequest(request);
  if (pathname === '/login') {
    if (!session) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = session.user.forcePasswordChange ? '/change-password' : '/';
    return NextResponse.redirect(url);
  }
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (session.user.forcePasswordChange && pathname !== '/change-password') {
    const url = request.nextUrl.clone();
    url.pathname = '/change-password';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'] };

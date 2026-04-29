"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/public')) return;
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.user_metadata?.force_password_change === true) {
      router.replace('/change-password');
      return;
    }
  }, [user, isLoading, router, pathname]);

  if (pathname.startsWith('/public')) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#2166be] border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.user_metadata?.force_password_change === true) {
    return null;
  }

  return <>{children}</>;
}

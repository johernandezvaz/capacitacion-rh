"use client";

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { AuthProvider } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';

const PUBLIC_PATHS = ['/login', '/change-password'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (
    pathname.startsWith('/public/') ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:ml-64 overflow-y-auto">
            {children}
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}

"use client";

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { AuthProvider } from '@/contexts/auth-context';

const NO_SIDEBAR_PATHS = ['/login', '/change-password'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const showSidebar =
    !NO_SIDEBAR_PATHS.includes(pathname) &&
    !pathname.startsWith('/public/');

  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        {showSidebar && <Sidebar />}
        <main className={showSidebar ? 'flex-1 lg:ml-64 overflow-y-auto' : 'flex-1'}>
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}

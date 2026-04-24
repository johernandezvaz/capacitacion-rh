import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sistema de Capacitaciones - Safe Demo',
  description: 'Sistema interno de gestión de capacitaciones corporativas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:ml-64 overflow-y-auto">
            {children}
          </main>
        </div>
        <Toaster />
        <SonnerToaster richColors position="top-center" />
      </body>
    </html>
  );
}

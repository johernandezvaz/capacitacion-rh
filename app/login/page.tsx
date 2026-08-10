"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session').then(async (response) => {
      if (!response.ok) return;
      const { user } = await response.json();
      if (!user) return;
      if (user.force_password_change === true) {
        router.replace('/change-password');
      } else {
        router.replace('/');
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
        return;
      }

      const { force_password_change: forcePasswordChange } = await response.json();
      if (forcePasswordChange === true) {
        router.replace('/change-password');
      } else {
        router.replace('/');
      }
    } catch {
      setError('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#192b52] rounded-xl p-4 mb-4 flex items-center justify-center w-20 h-20">
            <Image
              src="/safe-demo_logo-blc-Photoroom.png"
              alt="Safe Demo Logo"
              width={60}
              height={60}
              className="w-auto h-10 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-center">
            Sistema de Capacitaciones
          </h1>
          <p className="text-muted-foreground text-sm text-center mt-1">
            Inicia sesión para continuar
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-sm p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2166be] focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2166be] focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-[#2166be] hover:bg-[#1a5299] disabled:opacity-60 text-white font-medium rounded-md text-sm transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Safe Demo — Sistema interno de gestión de capacitaciones
        </p>
      </div>
    </div>
  );
}

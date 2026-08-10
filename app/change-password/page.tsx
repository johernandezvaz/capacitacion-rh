"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session').then(async (response) => {
      if (!response.ok) {
        window.location.href = '/login';
        return;
      }
      const { user } = await response.json();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (user.force_password_change !== true) {
        window.location.href = '/';
        return;
      }
      setIsChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      if (!response.ok) {
        setError('No se pudo actualizar la contraseña. Intenta de nuevo.');
        return;
      }

      router.replace('/');
    } catch {
      setError('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2166be] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
            Cambiar Contraseña
          </h1>
          <p className="text-muted-foreground text-sm text-center mt-1">
            Debes establecer una nueva contraseña para continuar
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-sm p-6 space-y-5">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-sm text-amber-800">
              Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="block text-sm font-medium text-foreground">
                Contraseña actual
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Contraseña temporal"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2166be] focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2166be] focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
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
                  Guardando...
                </>
              ) : (
                'Guardar contraseña'
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

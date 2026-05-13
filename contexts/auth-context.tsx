"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authLog, summarizeSession, dumpLocalStorageAuth } from '@/lib/auth-debug';

interface AuthContextValue {
  user: User | null;
  plantId: string | null;
  plantName: string | null;
  role: 'admin' | 'user' | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  plantId: null,
  plantName: null,
  role: null,
  isLoading: false,
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [plantName, setPlantName] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlantData = async (uid: string) => {
    authLog('auth', 'loadPlantData START', { uid });
    try {
      const { data: userPlant, error: plantError } = await supabase
        .from('user_plants')
        .select('plant_id, role')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();

      if (plantError) {
        authLog('warn', 'loadPlantData ERROR user_plants', { code: plantError.code, message: plantError.message, details: plantError.details, hint: plantError.hint });
        setPlantId(null);
        setPlantName(null);
        setRole(null);
        return;
      }

      if (userPlant) {
        authLog('auth', 'loadPlantData user_plants OK', { plant_id: userPlant.plant_id, role: userPlant.role });
        setPlantId(userPlant.plant_id);
        setRole(userPlant.role as 'admin' | 'user');
        const { data: plant, error: nameError } = await supabase
          .from('plants')
          .select('name')
          .eq('id', userPlant.plant_id)
          .maybeSingle();

        if (nameError) {
          authLog('warn', 'loadPlantData ERROR plants', { code: nameError.code, message: nameError.message });
          setPlantName(null);
        } else {
          authLog('auth', 'loadPlantData plants OK', { name: plant?.name });
          setPlantName(plant?.name ?? null);
        }
      } else {
        authLog('warn', 'loadPlantData: user_plants devolvió null (sin planta asignada)', { uid });
        setPlantId(null);
        setPlantName(null);
        setRole(null);
      }
    } catch (err) {
      authLog('warn', 'loadPlantData EXCEPCIÓN', { error: String(err) });
      setPlantId(null);
      setPlantName(null);
      setRole(null);
    }
    authLog('auth', 'loadPlantData END');
  };

  const clearAuth = () => {
    setUser(null);
    setPlantId(null);
    setPlantName(null);
    setRole(null);
  };

  // Efecto 1: inicializar sesión y escuchar cambios de auth.
  // REGLA: onAuthStateChange solo actualiza `user` (state puro).
  // NUNCA llamar queries de Supabase dentro de este callback — deadlock con locks internos.
  useEffect(() => {
    let mounted = true;

    authLog('auth', 'AuthProvider mount', {
      path: typeof window !== 'undefined' ? window.location.pathname : '(ssr)',
      storage: dumpLocalStorageAuth(),
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      authLog('auth', 'getSession() resuelto', { session: summarizeSession(session), error: error?.message });
      if (error || !session) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      setUser(session.user);
      // isLoading se apaga en el efecto de plantData cuando termina
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      authLog('auth', `onAuthStateChange: ${event}`, { session: summarizeSession(session) });

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
        if (typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/public')) {
          authLog('auth', 'SIGNED_OUT → redirect /login');
          router.replace('/login');
        }
        return;
      }

      if (event === 'INITIAL_SESSION') return;

      // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED: solo actualizar user
      setUser(session?.user ?? null);
    });

    const handleStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith('sb-')) return;
      authLog('storage', `storage event: ${e.key}`, { removed: e.newValue === null });
      if (e.newValue === null && typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/public')) {
        authLog('auth', 'storage cleared por otra pestaña → redirect /login');
        window.location.replace('/login');
      }
    };

    const handleVisibility = () =>
      authLog('visibility', `visibilitychange: ${document.visibilityState}`, { storage: dumpLocalStorageAuth() });
    const handleFocus = () => authLog('visibility', 'window focus');
    const handleBlur = () => authLog('visibility', 'window blur');

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [router]);

  // Efecto 2: cargar datos de planta cuando cambia el user.id.
  // Separado del efecto de auth para no bloquear el cliente de Supabase.
  useEffect(() => {
    if (user === null) {
      setPlantId(null);
      setPlantName(null);
      setRole(null);
      return;
    }

    let mounted = true;

    loadPlantData(user.id).finally(() => {
      if (mounted) {
        authLog('auth', 'setIsLoading(false) tras loadPlantData');
        setIsLoading(false);
      }
    });

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signOut = async () => {
    clearAuth();
    router.replace('/login');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('signOut error (ignorado, sesión ya limpiada):', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, plantId, plantName, role, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

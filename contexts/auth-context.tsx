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
  isLoading: true,
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

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      authLog('auth', 'AuthProvider mount → initialize()', {
        path: typeof window !== 'undefined' ? window.location.pathname : '(ssr)',
        storage: dumpLocalStorageAuth(),
      });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        authLog('auth', 'getSession() resuelto', { session: summarizeSession(session) });

        if (!session) {
          clearAuth();
          setIsLoading(false);
          return;
        }

        setUser(session.user);
        await loadPlantData(session.user.id);
        if (mounted) setIsLoading(false);
      } catch (e) {
        authLog('warn', 'initialize() lanzó excepción', { error: String(e) });
        if (mounted) {
          clearAuth();
          setIsLoading(false);
        }
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        authLog('auth', `onAuthStateChange: ${event}`, { session: summarizeSession(session) });

        if (event === 'SIGNED_OUT') {
          clearAuth();
          setIsLoading(false);
          if (typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/login') &&
            !window.location.pathname.startsWith('/public')) {
            authLog('auth', 'SIGNED_OUT → redirect a /login');
            router.replace('/login');
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          setIsLoading(false);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadPlantData(currentUser.id);
        } else {
          clearAuth();
        }

        if (mounted) setIsLoading(false);
      }
    );

    const handleStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (!e.key.startsWith('sb-')) return;
      authLog('storage', `storage event: ${e.key}`, {
        oldPresent: e.oldValue !== null,
        newPresent: e.newValue !== null,
      });
      if (e.newValue === null) {
        clearAuth();
        setIsLoading(false);
        if (typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/public')) {
          authLog('auth', 'storage cleared en otra pestaña → redirect a /login');
          window.location.replace('/login');
        }
      }
    };

    const handleVisibility = () => {
      authLog('visibility', `visibilitychange: ${document.visibilityState}`, {
        path: window.location.pathname,
        storage: dumpLocalStorageAuth(),
      });
    };

    const handleFocus = () => {
      authLog('visibility', 'window focus', { path: window.location.pathname });
    };

    const handleBlur = () => {
      authLog('visibility', 'window blur', { path: window.location.pathname });
    };

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

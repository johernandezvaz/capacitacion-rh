"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authLog, summarizeSession, dumpLocalStorageAuth } from '@/lib/auth-debug';

const initializedRef = useRef(false);

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

//

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [plantName, setPlantName] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlantData = async (uid: string) => {
    try {
      const { data: userPlant, error: plantError } = await supabase
        .from('user_plants')
        .select('plant_id, role')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();

      if (plantError) {
        console.error('Error loading user_plants:', plantError);
        setPlantId(null);
        setPlantName(null);
        setRole(null);
        return;
      }

      if (userPlant) {
        setPlantId(userPlant.plant_id);
        setRole(userPlant.role as 'admin' | 'user');

        const { data: plant, error: nameError } = await supabase
          .from('plants')
          .select('name')
          .eq('id', userPlant.plant_id)
          .maybeSingle();

        if (nameError) {
          console.error('Error loading plant name:', nameError);
          setPlantName(null);
        } else {
          setPlantName(plant?.name ?? null);
        }
      } else {
        setPlantId(null);
        setPlantName(null);
        setRole(null);
      }
    } catch (err) {
      console.error('Error loading plant data:', err);
      setPlantId(null);
      setPlantName(null);
      setRole(null);
    }
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
      if (initializedRef.current) {
        authLog('auth', 'initialize() SKIPPED (ya ejecutado)');
        return;
      }

      initializedRef.current = true;

      authLog('auth', 'AuthProvider mount → initialize()', {
        path: typeof window !== 'undefined' ? window.location.pathname : '(ssr)',
        storage: dumpLocalStorageAuth(),
      });

      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        authLog('auth', 'getUser() resuelto', {
          user_id: user?.id,
          error: error?.message,
        });

        if (!user) {
          setIsLoading(false);
          return;
        }

        setUser(user);
        await loadPlantData(user.id);
        setIsLoading(false);

      } catch (e) {
        authLog('warn', 'initialize() lanzó excepción', { error: String(e) });
        clearAuth();
        setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        authLog('auth', `onAuthStateChange: ${event}`, {
          session: summarizeSession(session),
        });

        if (event === 'SIGNED_OUT') {
          clearAuth();
          setIsLoading(false);

          if (
            typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/login') &&
            !window.location.pathname.startsWith('/public')
          ) {
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

        if (event === 'INITIAL_SESSION') return;

        const currentUser = session?.user ?? null;

        // 🔥 CLAVE: ignorar SIGNED_IN redundante
        if (event === 'SIGNED_IN' && user?.id === currentUser?.id) {
          authLog('auth', 'SIGNED_IN ignorado (mismo usuario)');
          return;
        }

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

        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/public')
        ) {
          authLog('auth', 'storage cleared → redirect');
          window.location.replace('/login');
        }
      }
    };

    const handleVisibility = () => {
      authLog('visibility', `visibilitychange: ${document.visibilityState}`, {
        path: window.location.pathname,
      });
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router, user?.id]);

  const signOut = async () => {
    clearAuth();
    router.replace('/login');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('signOut error (ignorado):', err);
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
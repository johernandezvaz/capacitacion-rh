"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
    let validating = false;

    const hardSignOut = async () => {
      try { await supabase.auth.signOut(); } catch { }
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('sb-session');
          Object.keys(window.localStorage)
            .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
            .forEach(k => window.localStorage.removeItem(k));
        }
      } catch { }
      clearAuth();
    };

    const getCurrentAccessToken = async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    };

    const validateSession = async (opts: { reloadOnRefresh: boolean; redirectOnFail: boolean }) => {
      if (validating) return;
      validating = true;
      try {
        const tokenBefore = await getCurrentAccessToken();

        if (!tokenBefore) {
          if (mounted) {
            clearAuth();
            setIsLoading(false);
            if (opts.redirectOnFail) router.replace('/login');
          }
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!mounted) return;

        const isAuthError =
          !!userError &&
          (userError.status === 401 ||
            userError.status === 403 ||
            /jwt|token|session|expired|invalid/i.test(userError.message ?? ''));

        if (isAuthError || !userData?.user) {
          await hardSignOut();
          if (!mounted) return;
          setIsLoading(false);
          if (opts.redirectOnFail) router.replace('/login');
          return;
        }

        if (userError) {
          return;
        }

        setUser(userData.user);

        const tokenAfter = await getCurrentAccessToken();
        if (!mounted) return;

        if (
          opts.reloadOnRefresh &&
          tokenAfter &&
          tokenBefore &&
          tokenAfter !== tokenBefore &&
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
          window.location.reload();
        }
      } catch {
      } finally {
        validating = false;
      }
    };

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          clearAuth();
          setIsLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!mounted) return;

        if (userError || !userData?.user) {
          await hardSignOut();
          if (!mounted) return;
          setIsLoading(false);
          return;
        }

        setUser(userData.user);
        await loadPlantData(userData.user.id);
        if (mounted) setIsLoading(false);
      } catch {
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

        if (event === 'SIGNED_OUT') {
          clearAuth();
          setIsLoading(false);
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateSession({ reloadOnRefresh: true, redirectOnFail: true });
      }
    };

    const handleFocus = () => {
      validateSession({ reloadOnRefresh: true, redirectOnFail: true });
    };

    const handleOnline = () => {
      validateSession({ reloadOnRefresh: true, redirectOnFail: true });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
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

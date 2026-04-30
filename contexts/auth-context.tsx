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
    let revalidating = false;

    const revalidateSession = async (forceRedirectOnFail: boolean) => {
      if (revalidating) return;
      revalidating = true;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error || !session) {
          clearAuth();
          setIsLoading(false);
          if (forceRedirectOnFail) {
            try { await supabase.auth.signOut(); } catch { }
            router.replace('/login');
          }
          return;
        }

        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const now = Date.now();
        if (expiresAt && expiresAt - now < 60_000) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (!mounted) return;
          if (refreshError || !refreshed.session) {
            clearAuth();
            setIsLoading(false);
            if (forceRedirectOnFail) {
              try { await supabase.auth.signOut(); } catch { }
              router.replace('/login');
            }
            return;
          }
          setUser(refreshed.session.user);
        } else {
          setUser(session.user);
        }
      } catch {
        if (!mounted) return;
        clearAuth();
        setIsLoading(false);
        if (forceRedirectOnFail) router.replace('/login');
      } finally {
        revalidating = false;
      }
    };

    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error || !session) {
          clearAuth();
          setIsLoading(false);
          return;
        }

        setUser(session.user);
        await loadPlantData(session.user.id);
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
        revalidateSession(true);
      }
    };

    const handleFocus = () => {
      revalidateSession(true);
    };

    const handleOnline = () => {
      revalidateSession(true);
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

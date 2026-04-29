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
      const { data: userPlant } = await supabase
        .from('user_plants')
        .select('plant_id, role')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();

      if (userPlant) {
        setPlantId(userPlant.plant_id);
        setRole(userPlant.role as 'admin' | 'user');
        const { data: plant } = await supabase
          .from('plants')
          .select('name')
          .eq('id', userPlant.plant_id)
          .maybeSingle();
        setPlantName(plant?.name ?? null);
      } else {
        setPlantId(null);
        setPlantName(null);
        setRole(null);
      }
    } catch (err) {
      console.error('Error loading plant data:', err);
    }
  };

  const clearAuth = () => {
    setUser(null);
    setPlantId(null);
    setPlantName(null);
    setRole(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          clearAuth();
          setIsLoading(false);
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadPlantData(currentUser.id);
        } else {
          clearAuth();
        }

        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        ),
      ]);
    } catch (err) {
      console.warn('signOut timeout o error, forzando limpieza:', err);
    } finally {
      clearAuth();
      router.replace('/login');
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

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  forcePasswordChange: boolean;
};

interface AuthContextValue {
  user: AuthUser | null;
  plantId: string | null;
  plantName: string | null;
  role: "admin" | "user" | null;
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

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [plantName, setPlantName] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const data = await response.json();

        if (!mounted) return;

        if (!data.session?.user) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        setUser(data.session.user);
      } catch (error) {
        console.error("[auth] Error loading session:", error);

        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setPlantId(null);
      setPlantName(null);
      setRole(null);
      router.replace("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        plantId,
        plantName,
        role,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type AuthUser = {
  id: string;
  email: string;
  passwordHash?: string;
  forcePasswordChange?: boolean;
  force_password_change?: boolean;
  name?: string;
  user_metadata?: {
    name?: string;
    force_password_change?: boolean;
  };
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
            setPlantId(null);
            setPlantName(null);
            setRole(null);
            setIsLoading(false);
          }
          return;
        }

        const data = await response.json();

        if (!mounted) return;

        const rawUser = data.user || data.session?.user;

        if (!rawUser) {
          setUser(null);
          setPlantId(null);
          setPlantName(null);
          setRole(null);
          setIsLoading(false);
          return;
        }

        const forceChange =
          rawUser.forcePasswordChange ??
          rawUser.force_password_change ??
          false;

        const authUser: AuthUser = {
          id: rawUser.id,
          email: rawUser.email,
          forcePasswordChange: forceChange,
          force_password_change: forceChange,
          user_metadata: {
            name: rawUser.name || rawUser.email,
            force_password_change: forceChange,
          },
        };

        setUser(authUser);

        setPlantId(data.plant?.id ?? null);
        setPlantName(data.plant?.name ?? null);

        setRole(
          data.role === "admin" || data.role === "user"
            ? data.role
            : null
        );

        setIsLoading(false);
      } catch (error) {
        console.error("[auth] Error loading session:", error);

        if (mounted) {
          setUser(null);
          setPlantId(null);
          setPlantName(null);
          setRole(null);
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
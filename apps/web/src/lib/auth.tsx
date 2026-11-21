import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { AuthResponse, AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<AuthResponse | null> => {
      try {
        return await api.get<AuthResponse>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const setUser = useCallback(
    (user: AuthUser | null) => {
      queryClient.setQueryData<AuthResponse | null>(["auth", "me"], user ? { user } : null);
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    const result = await api.get<AuthResponse>("/auth/me").catch((error) => {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    });
    queryClient.setQueryData<AuthResponse | null>(["auth", "me"], result);
  }, [queryClient]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    queryClient.setQueryData<AuthResponse | null>(["auth", "me"], null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data?.user ?? null,
      isLoading,
      setUser,
      refresh,
      logout,
    }),
    [data, isLoading, setUser, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

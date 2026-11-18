import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AppInfo } from "@/shared/api";
import { roleAtLeast, type Role, type SessionUser } from "@/shared/auth";
import { api } from "./api";

export function useSession() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["session"],
    queryFn: () => api.get<{ user: SessionUser | null; demo?: boolean }>("/api/auth/session"),
    staleTime: 60_000,
  });
  useEffect(() => {
    const onUnauthorized = () => queryClient.setQueryData(["session"], (current: { demo?: boolean } | undefined) => ({ user: null, demo: current?.demo ?? false }));
    window.addEventListener("sistemele:unauthorized", onUnauthorized);
    return () => window.removeEventListener("sistemele:unauthorized", onUnauthorized);
  }, [queryClient]);
  // `demo`: a public demo installation (one-click sign-in, sample data that resets).
  return { user: query.data?.user ?? null, demo: query.data?.demo ?? false, isLoading: query.isLoading };
}

/** The signed-in user. Only use inside the authenticated shell. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error("useUser() used outside the signed-in app");
  return user;
}

export function useCan(minimum: Role): boolean {
  const { user } = useSession();
  return Boolean(user && roleAtLeast(user.role, minimum));
}

export function useAppInfo(): AppInfo | undefined {
  return useQuery({ queryKey: ["app-info"], queryFn: () => api.get<AppInfo>("/api/app"), staleTime: 5 * 60_000 }).data;
}

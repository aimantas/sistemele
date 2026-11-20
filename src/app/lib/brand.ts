import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BrandInfo } from "@/shared/branding";
import { api } from "./api";

/** Public brand info (name, logo URL) — works on the sign-in page too. */
export function useBrandInfo(): BrandInfo | undefined {
  return useQuery({ queryKey: ["brand-info"], queryFn: () => api.get<BrandInfo>("/brand/info.json"), staleTime: 5 * 60_000 }).data;
}

/** Re-fetches the theme stylesheet and brand info after Settings → Brand is saved. */
export function useRefreshBrand() {
  const queryClient = useQueryClient();
  return async () => {
    const link = document.querySelector<HTMLLinkElement>('link[href^="/brand/theme"]');
    if (link) link.href = `/brand/theme?v=${Date.now()}`;
    await queryClient.invalidateQueries({ queryKey: ["brand-info"] });
  };
}

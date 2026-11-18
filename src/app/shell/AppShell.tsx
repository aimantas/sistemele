import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { LayoutDashboard, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router";
import { roleAtLeast } from "@/shared/auth";
import { clientModules } from "@/modules/client";
import type { NavItem } from "@/modules/types.client";
import { api } from "../lib/api";
import { brandLogoSrc, useBrandInfo } from "../lib/brand";
import { useAppInfo, useSession } from "../lib/session";
import { Spinner } from "../ui";
import { CommandPalette } from "./CommandPalette";

/** Signed-in frame: sidebar on desktop, drawer on phones, command palette everywhere. */
export function AppShell() {
  const { user, isLoading } = useSession();
  const info = useAppInfo();
  const brand = useBrandInfo();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Close the phone menu after navigation (state derived during render, no effect).
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["session"], { user: null });
    },
  });

  if (isLoading) return <Spinner label="Opening" />;
  if (!user) return <Navigate to={`/app/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const groups: Array<{ label?: string; items: NavItem[] }> = [
    { items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard }] },
    ...clientModules.map((module) => ({ label: module.name, items: module.nav.filter((item) => roleAtLeast(user.role, item.minRole ?? "member")) })).filter((group) => group.items.length),
    { items: [{ to: "/app/settings", label: "Settings", icon: Settings }] },
  ];

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      <Link to="/app" className="flex min-h-8 items-center gap-2 px-2 text-[15px] font-semibold tracking-tight">
        {brand?.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="h-7 w-auto max-w-[180px]" />
        ) : (
          <>
            <img src="/favicon.svg" alt="" className="size-6" />
            {brand?.name ?? info?.appName ?? "Sistemėlė"}
          </>
        )}
      </Link>
      <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-9 items-center gap-2 rounded-control border border-line bg-paper px-3 text-sm text-muted hover:border-line-strong">
        <Search className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-line px-1.5 font-mono text-[11px]">⌘K</kbd>
      </button>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="grid gap-0.5">
          {group.label ? <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</p> : null}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) => clsx("flex h-9 items-center gap-2.5 rounded-control px-2 text-sm font-medium", isActive ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-sunken hover:text-ink")}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="mt-auto grid gap-1 border-t border-line pt-3">
        <p className="truncate px-2 text-sm font-medium">{user.name || user.email}</p>
        <p className="truncate px-2 text-xs text-muted">
          {user.email} · {user.role}
        </p>
        <button type="button" onClick={() => logout.mutate()} className="mt-1 flex h-9 items-center gap-2.5 rounded-control px-2 text-sm text-ink-soft hover:bg-sunken hover:text-ink">
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr] print:block">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block print:hidden">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden print:hidden">
        <Link to="/app" className="flex items-center gap-2 font-semibold">
          <img src={brandLogoSrc(brand)} alt={brand?.logoUrl ? brand.name : ""} className={brand?.logoUrl ? "h-7 w-auto max-w-[160px]" : "size-6"} />
          {brand?.logoUrl ? null : (brand?.name ?? info?.appName ?? "Sistemėlė")}
        </Link>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Search" className="inline-grid size-10 place-items-center rounded-control hover:bg-sunken" onClick={() => setPaletteOpen(true)}>
            <Search className="size-5" />
          </button>
          <button type="button" aria-label="Open menu" aria-expanded={menuOpen} className="inline-grid size-10 place-items-center rounded-control hover:bg-sunken" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(300px,85vw)] bg-surface shadow-2xl">
            <button type="button" aria-label="Close menu" className="absolute top-3 right-3 inline-grid size-9 place-items-center rounded-control hover:bg-sunken" onClick={() => setMenuOpen(false)}>
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

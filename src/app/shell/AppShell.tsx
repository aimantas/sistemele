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
  const { user, demo, isLoading } = useSession();
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

  const initials = (user.name || user.email).split(/[\s@.]+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
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
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md border bg-card px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border bg-muted px-1.5 font-sans text-[11px] font-medium">⌘K</kbd>
      </button>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="grid gap-px">
          {group.label ? <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p> : null}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                clsx(
                  "group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                  isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-foreground/75 hover:bg-sidebar-accent/70 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="mt-auto grid gap-2 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name || user.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.role} · {user.email}
            </p>
          </div>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={() => logout.mutate()} className="inline-grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground">
            <LogOut className="size-4" />
          </button>
        </div>
        <Link to="/app/design" className="px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          Design system
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr] print:block">
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border bg-sidebar lg:block print:hidden">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-md lg:hidden print:hidden">
        <Link to="/app" className="flex items-center gap-2 font-semibold">
          <img src={brandLogoSrc(brand)} alt={brand?.logoUrl ? brand.name : ""} className={brand?.logoUrl ? "h-7 w-auto max-w-[160px]" : "size-6"} />
          {brand?.logoUrl ? null : (brand?.name ?? info?.appName ?? "Sistemėlė")}
        </Link>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Search" className="inline-grid size-10 place-items-center rounded-md hover:bg-accent" onClick={() => setPaletteOpen(true)}>
            <Search className="size-5" />
          </button>
          <button type="button" aria-label="Open menu" aria-expanded={menuOpen} className="inline-grid size-10 place-items-center rounded-md hover:bg-accent" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 animate-in bg-black/50 fade-in-0" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(300px,85vw)] animate-in border-r bg-sidebar shadow-lg slide-in-from-left">
            <button type="button" aria-label="Close menu" className="absolute top-3 right-3 inline-grid size-9 place-items-center rounded-md hover:bg-sidebar-accent" onClick={() => setMenuOpen(false)}>
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {demo ? (
          <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-xs">
            <span className="size-1.5 rounded-full bg-info" aria-hidden />
            Demo with sample data. It resets every hour, and no email is sent.
            <a className="font-medium text-foreground underline underline-offset-4" href="https://github.com/aimantas/sistemele">
              Get the code on GitHub
            </a>
          </p>
        ) : null}
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

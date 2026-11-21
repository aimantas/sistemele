import type { SessionUser } from "@/shared/auth";
import type { ModuleContext } from "@/modules/types.server";

/** Worker bindings and variables. Keep in sync with wrangler.jsonc and .dev.vars.example. */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_NAME: string;
  /** Canonical origin without trailing slash, e.g. https://example.com. Empty: the address each request came to. */
  APP_URL: string;
  APP_ENV: "development" | "preview" | "production" | string;
  EMAIL_FROM: string;
  /** Comma-separated; these addresses become owners on first sign-in. A secret in production (`wrangler secret put ADMIN_EMAILS`). */
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** "1" turns the installation into a public demo: one-click sign-in, no email, hourly reset. See docs/deployment.md. */
  DEMO_MODE?: string;
  /** "1" lets search engines index public pages outside production (e.g. a public demo). The dashboard and private links stay noindex. */
  ALLOW_INDEXING?: string;
}

export interface AppVariables {
  user: SessionUser | null;
  moduleContext: ModuleContext | undefined;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

export function isDevelopment(env: Pick<Env, "APP_ENV">): boolean {
  return env.APP_ENV === "development";
}

/**
 * Public demo: anyone can open the dashboard as the demo owner; data is reset
 * by the Cron Trigger. Needs both DEMO_MODE and APP_ENV=demo, so one stray
 * variable on a production Worker can never open it up or wipe it.
 */
export function isDemo(env: Pick<Env, "DEMO_MODE" | "APP_ENV">): boolean {
  return (env.DEMO_MODE === "1" || env.DEMO_MODE === "true") && env.APP_ENV === "demo";
}

/**
 * True for records a demo visitor created (seed records carry "_demo_" in
 * their id). Their public pages are noindex, left out of the sitemap and
 * their links are nofollow, so the public demo cannot host spam.
 */
export function isDemoVisitorRecord(env: Pick<Env, "DEMO_MODE" | "APP_ENV">, id: string): boolean {
  return isDemo(env) && !/^[a-z]+_demo_/u.test(id);
}

/** Public pages may be indexed: production, or any environment with ALLOW_INDEXING=1. */
export function isIndexable(env: Pick<Env, "APP_ENV" | "ALLOW_INDEXING">): boolean {
  return env.APP_ENV === "production" || env.ALLOW_INDEXING === "1" || env.ALLOW_INDEXING === "true";
}

export function appOrigin(env: Pick<Env, "APP_URL">): string {
  return env.APP_URL.replace(/\/+$/u, "");
}

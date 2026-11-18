import type { SessionUser } from "@/shared/auth";
import type { ModuleContext } from "@/modules/types.server";

/** Worker bindings and variables. Keep in sync with wrangler.jsonc and .dev.vars.example. */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_NAME: string;
  /** Canonical origin without trailing slash, e.g. https://example.com */
  APP_URL: string;
  APP_ENV: "development" | "preview" | "production" | string;
  EMAIL_FROM: string;
  ADMIN_EMAILS: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** "1" turns the installation into a public demo: one-click sign-in, no email, hourly reset. See docs/deployment.md. */
  DEMO_MODE?: string;
}

export interface AppVariables {
  user: SessionUser | null;
  moduleContext: ModuleContext | undefined;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

export function isDevelopment(env: Pick<Env, "APP_ENV">): boolean {
  return env.APP_ENV === "development";
}

/** Public demo: anyone can open the dashboard as the demo owner; data is reset by the Cron Trigger. */
export function isDemo(env: Pick<Env, "DEMO_MODE">): boolean {
  return env.DEMO_MODE === "1" || env.DEMO_MODE === "true";
}

export function appOrigin(env: Pick<Env, "APP_URL">): string {
  return env.APP_URL.replace(/\/+$/u, "");
}

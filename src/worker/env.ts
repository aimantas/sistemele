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
}

export interface AppVariables {
  user: SessionUser | null;
  moduleContext: ModuleContext | undefined;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

export function isDevelopment(env: Pick<Env, "APP_ENV">): boolean {
  return env.APP_ENV === "development";
}

export function appOrigin(env: Pick<Env, "APP_URL">): string {
  return env.APP_URL.replace(/\/+$/u, "");
}

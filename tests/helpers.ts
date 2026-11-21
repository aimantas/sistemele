import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { serverModules } from "@/modules/server";
import type { ServerModule } from "@/modules/types.server";
import { createApp } from "@/worker/app";
import type { Env } from "@/worker/env";

/**
 * Test harness: a real D1 database (Miniflare, in memory) with every
 * migration applied, and the real Hono app. No mocks of our own code.
 */
export interface TestApp {
  env: Env;
  db: D1Database;
  /** Fetch against the app. Paths are relative to http://localhost. */
  request(path: string, init?: RequestInit & { json?: unknown; cookie?: string; token?: string }): Promise<Response>;
  /** Signs in through the real magic-link flow and returns the session cookie. */
  signIn(email?: string): Promise<string>;
  /** Creates an API token for a signed-in cookie. */
  createToken(cookie: string, role?: "owner" | "admin" | "member"): Promise<string>;
  /** Promises passed to waitUntil (emails sent after the response). */
  settle(): Promise<void>;
  dispose(): Promise<void>;
}

export const ORIGIN = "http://localhost";

export function migrationStatements(): string[] {
  const dir = join(process.cwd(), "migrations");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      readFileSync(join(dir, file), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .split(/;\s*(?:\n|$)/u)
        .map((statement) => statement.trim())
        .filter(Boolean),
    );
}

export async function createTestApp(options: { modules?: ServerModule[]; env?: Partial<Env> } = {}): Promise<TestApp> {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }", d1Databases: { DB: "test-db" } });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));

  const env: Env = {
    DB: db,
    // Stand-in for the static asset server: only the SPA shell exists.
    ASSETS: {
      fetch: async (input: RequestInfo | URL) =>
        new URL(input instanceof Request ? input.url : String(input)).pathname === "/"
          ? new Response("<!doctype html><div id=\"root\"></div>", { headers: { "content-type": "text/html" } })
          : new Response("Not found", { status: 404 }),
    } as unknown as Fetcher,
    APP_NAME: "Sistemele Test",
    APP_URL: ORIGIN,
    APP_ENV: "development",
    EMAIL_FROM: "Test <test@example.com>",
    ADMIN_EMAILS: "owner@example.com",
    ...options.env,
  };
  const app = createApp(options.modules ?? serverModules);
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: (promise: Promise<unknown>) => pending.push(promise), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

  const request: TestApp["request"] = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    let body = init.body;
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.json);
    }
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.token) headers.set("authorization", `Bearer ${init.token}`);
    const method = (init.method ?? "GET").toUpperCase();
    if (!["GET", "HEAD"].includes(method) && !headers.has("origin") && !init.token) headers.set("origin", ORIGIN);
    return app.fetch(new Request(`${ORIGIN}${path}`, { ...init, method, headers, body }), env, executionCtx);
  };

  const signIn: TestApp["signIn"] = async (email = "owner@example.com") => {
    const link = await request("/api/auth/link", { method: "POST", json: { email } });
    const { devLink } = (await link.json()) as { devLink?: string };
    if (!devLink) throw new Error(`No sign-in link for ${email}; add the user first.`);
    const token = new URL(devLink).searchParams.get("token");
    const verified = await request("/api/auth/verify", { method: "POST", json: { token } });
    if (verified.status !== 200) throw new Error(`Verify failed: ${verified.status} ${await verified.text()}`);
    const cookie = verified.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("No session cookie");
    return cookie;
  };

  const createToken: TestApp["createToken"] = async (cookie, role = "member") => {
    const response = await request("/api/api-tokens", { method: "POST", cookie, json: { name: "test", role } });
    return ((await response.json()) as { token: string }).token;
  };

  return {
    env,
    db,
    request,
    signIn,
    createToken,
    settle: async () => {
      await Promise.all(pending.splice(0));
    },
    // Work scheduled with waitUntil finishes before the database goes away.
    dispose: async () => {
      await Promise.allSettled(pending.splice(0));
      await mf.dispose();
    },
  };
}

/** Adds a user directly in the database (for role tests). */
export async function addUser(t: TestApp, email: string, role: "owner" | "admin" | "member"): Promise<void> {
  await t.db.prepare("INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)").bind(`usr_${email}`, email, email.split("@")[0], role).run();
}

export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

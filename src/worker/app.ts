import { Hono, type Context, type MiddlewareHandler } from "hono";
import type { ModuleContext, ServerModule } from "@/modules/types.server";
import { authRoutes } from "./auth/routes";
import { userFromApiToken, userFromSession } from "./auth/sessions";
import { createModuleContext } from "./context";
import { coreRoutes } from "./core/routes";
import { appOrigin, isDevelopment, type AppEnv } from "./env";
import { Db } from "./lib/db";
import { forbidden, handleError, unauthorized } from "./lib/errors";
import { mcpRoutes } from "./mcp/routes";
import { brandRoutes } from "./site/brand";
import { discoveryRoutes } from "./site/discovery";
import { renderNotFound, sitePages } from "./site/pages";
import { setSiteNavigation } from "./site/render";

const isApi = (path: string) => path === "/api" || path.startsWith("/api/");
const isPublicApi = (path: string) => path.startsWith("/api/auth/") || path.startsWith("/api/public/");

function waitUntilFor(c: Context<AppEnv>): ((promise: Promise<unknown>) => void) | undefined {
  try {
    const executionCtx = c.executionCtx;
    return (promise) => executionCtx.waitUntil(promise);
  } catch {
    return undefined;
  }
}

/** Resolves the user (API token first, then session cookie) and builds the module context. */
function contextMiddleware(modules: readonly ServerModule[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let user = null;
    if (isApi(c.req.path) || c.req.path === "/mcp") {
      const db = new Db(c.env.DB);
      user = (await userFromApiToken(db, c.req.header("authorization"))) ?? (await userFromSession(c, db));
    }
    c.set("user", user);
    c.set("moduleContext", createModuleContext({ env: c.env, user, modules, waitUntil: waitUntilFor(c) }));
    await next();
  };
}

/**
 * Cookie-authenticated writes must come from our own origin. Bearer-token
 * requests carry no ambient credentials, so they are exempt.
 */
const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  if (c.req.header("authorization")?.startsWith("Bearer ")) return next();
  const origin = c.req.header("origin");
  const allowed = new Set([appOrigin(c.env), new URL(c.req.url).origin]);
  const sameSite = c.req.header("sec-fetch-site");
  if ((origin && allowed.has(origin)) || (!origin && sameSite === "same-origin")) return next();
  throw forbidden("Cross-site request blocked.");
};

const requireSignedIn: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isPublicApi(c.req.path) && !c.get("user")) throw unauthorized();
  await next();
};

const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  // Responses from env.ASSETS (and fetch) have immutable headers; copy before editing.
  c.res = new Response(c.res.body, c.res);
  const headers = c.res.headers;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  if (!isDevelopment(c.env)) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if ((headers.get("Content-Type") ?? "").includes("text/html")) {
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
      );
    }
  }
  if (isApi(c.req.path)) headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
};

/** The dashboard SPA shell for /app and /app/*. */
async function serveApp(c: Context<AppEnv>): Promise<Response> {
  const response = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "no-cache");
  return new Response(response.body, { status: response.status, headers });
}

export function validateModules(modules: readonly ServerModule[]): void {
  const ids = new Set(modules.map((module) => module.id));
  for (const module of modules) {
    for (const required of module.requires ?? []) {
      if (!ids.has(required)) throw new Error(`Module "${module.id}" requires "${required}". Enable it in sistemele.config.ts.`);
    }
  }
}

export function createApp(modules: readonly ServerModule[]) {
  validateModules(modules);
  setSiteNavigation({
    start: [{ label: "Home", href: "/" }, ...modules.flatMap((module) => module.siteLinks ?? [])],
    menus: modules.flatMap((module) => (module.siteMenu ? [(ctx: ModuleContext) => module.siteMenu!(ctx)] : [])),
    end: modules.some((m) => m.id === "crm") ? [{ label: "Request a quote", href: "/contact" }] : [],
  });

  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.notFound((c) => (isApi(c.req.path) ? c.json({ error: { code: "not_found", message: "Unknown endpoint." } }, 404) : renderNotFound(c)));

  app.use("*", securityHeaders);
  app.use("*", contextMiddleware(modules));
  app.use("/api/*", csrfGuard);
  app.use("/mcp", csrfGuard);
  app.use("/api/*", requireSignedIn);

  app.route("/api/auth", authRoutes);
  for (const module of modules) if (module.publicApi) app.route(`/api/public/${module.id}`, module.publicApi);
  app.route("/api", coreRoutes(modules));
  for (const module of modules) if (module.api) app.route(`/api/${module.id}`, module.api);
  app.route("/mcp", mcpRoutes(modules));

  app.route("/", brandRoutes);
  app.route("/", discoveryRoutes(modules));
  app.route("/", sitePages(modules));
  for (const module of modules) if (module.site) app.route("/", module.site);

  app.get("/app", serveApp);
  app.get("/app/*", serveApp);

  // Static files from the build; anything else is a real 404 page.
  app.all("*", async (c) => {
    if (c.req.method === "GET" || c.req.method === "HEAD") {
      const asset = await c.env.ASSETS.fetch(c.req.raw);
      if (asset.status !== 404) return asset;
    }
    return renderNotFound(c);
  });

  return app;
}

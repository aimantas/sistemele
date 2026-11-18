import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
});
afterAll(() => t.dispose());

describe("authentication", () => {
  it("rejects anonymous API calls", async () => {
    const response = await t.request("/api/me");
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("creates the first owner from ADMIN_EMAILS and returns the session", async () => {
    const response = await t.request("/api/me", { cookie: owner });
    expect(await json(response)).toMatchObject({ user: { email: "owner@example.com", role: "owner" } });
  });

  it("answers the same for unknown emails and never issues them a link", async () => {
    const response = await t.request("/api/auth/link", { method: "POST", json: { email: "stranger@example.com" } });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });
  });

  it("burns a sign-in link after one use", async () => {
    const link = await json<{ devLink: string }>(await t.request("/api/auth/link", { method: "POST", json: { email: "owner@example.com" } }));
    const token = new URL(link.devLink).searchParams.get("token");
    expect((await t.request("/api/auth/verify", { method: "POST", json: { token } })).status).toBe(200);
    expect((await t.request("/api/auth/verify", { method: "POST", json: { token } })).status).toBe(400);
  });

  it("never exposes the dev link outside local development", async () => {
    const prod = await createTestApp({ env: { APP_ENV: "production", APP_URL: "https://example.com" } });
    const response = await prod.request("/api/auth/link", { method: "POST", json: { email: "owner@example.com" }, headers: { origin: "https://example.com" } });
    expect(await json(response)).toEqual({ ok: true });
    await prod.dispose();
  });

  it("blocks cross-site cookie writes", async () => {
    const response = await t.request("/api/me", { method: "PATCH", cookie: owner, json: { name: "X" }, headers: { origin: "https://evil.example" } });
    expect(response.status).toBe(403);
  });

  it("logs out", async () => {
    const cookie = await t.signIn();
    await t.request("/api/auth/logout", { method: "POST", cookie });
    expect((await t.request("/api/me", { cookie })).status).toBe(401);
  });
});

describe("team and roles", () => {
  it("lets admins invite members and blocks members from team admin", async () => {
    const created = await t.request("/api/users", { method: "POST", cookie: owner, json: { email: "member@example.com", role: "member" } });
    expect(created.status).toBe(201);
    const member = await t.signIn("member@example.com");
    expect((await t.request("/api/users", { cookie: member })).status).toBe(403);
  });

  it("keeps at least one owner", async () => {
    const me = await json<{ user: { id: string } }>(await t.request("/api/me", { cookie: owner }));
    const response = await t.request(`/api/users/${me.user.id}`, { method: "PATCH", cookie: owner, json: { role: "member" } });
    expect(response.status).toBe(400);
  });

  it("does not let an admin create owners", async () => {
    await addUser(t, "admin@example.com", "admin");
    const admin = await t.signIn("admin@example.com");
    const response = await t.request("/api/users", { method: "POST", cookie: admin, json: { email: "x@example.com", role: "owner" } });
    expect(response.status).toBe(403);
  });
});

describe("API tokens and MCP", () => {
  it("authenticates with a bearer token and caps its role", async () => {
    const token = await t.createToken(owner, "member");
    const me = await json<{ user: { role: string; via: string } }>(await t.request("/api/me", { token }));
    expect(me.user).toMatchObject({ role: "member", via: "token" });
    expect((await t.request("/api/users", { token })).status).toBe(403);
  });

  it("speaks MCP: initialize, tools/list, tools/call", async () => {
    const token = await t.createToken(owner, "owner");
    const init = await json<{ result: { protocolVersion: string; serverInfo: { name: string } } }>(
      await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } } }),
    );
    expect(init.result).toMatchObject({ protocolVersion: "2025-06-18", serverInfo: { name: "sistemele" } });

    const notification = await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", method: "notifications/initialized" } });
    expect(notification.status).toBe(202);

    const list = await json<{ result: { tools: Array<{ name: string; inputSchema: { type: string } }> } }>(await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 2, method: "tools/list" } }));
    const names = list.result.tools.map((tool) => tool.name);
    expect(names).toContain("core_whoami");
    expect(names).toContain("crm_create_contact");
    expect(list.result.tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);

    const call = await json<{ result: { structuredContent: { user: { email: string } } } }>(
      await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "core_whoami", arguments: {} } } }),
    );
    expect(call.result.structuredContent.user.email).toBe("owner@example.com");
  });

  it("returns tool errors as isError results", async () => {
    const token = await t.createToken(owner, "owner");
    const call = await json<{ result: { isError: boolean } }>(
      await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "crm_create_contact", arguments: { name: "" } } } }),
    );
    expect(call.result.isError).toBe(true);
  });

  it("requires a token for MCP", async () => {
    expect((await t.request("/mcp", { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).status).toBe(401);
  });
});

describe("dashboard layout and settings", () => {
  it("saves and returns a per-user layout", async () => {
    const layout = { version: 1, widgets: [{ id: "w1", type: "core.metric", size: { w: 1, h: 1 }, config: { metric: "crm.open_pipeline_value" } }] };
    expect((await t.request("/api/dashboard/layout", { method: "PUT", cookie: owner, json: layout })).status).toBe(200);
    expect(await json(await t.request("/api/dashboard/layout", { cookie: owner }))).toEqual({ layout });
  });

  it("rejects invalid layouts", async () => {
    const response = await t.request("/api/dashboard/layout", { method: "PUT", cookie: owner, json: { version: 1, widgets: [{ id: "x", type: "y", size: { w: 9, h: 1 } }] } });
    expect(response.status).toBe(422);
  });

  it("stores the business profile", async () => {
    const response = await t.request("/api/settings/business", { method: "PUT", cookie: owner, json: { name: "Acme UAB", iban: "LT00 0000 0000 0000 0000", email: "sales@acme.test" } });
    expect(response.status).toBe(200);
    const stored = await json<{ business: { name: string; currency: string } }>(await t.request("/api/settings/business", { cookie: owner }));
    expect(stored.business).toMatchObject({ name: "Acme UAB", currency: "EUR" });
  });

  it("computes module metrics", async () => {
    const metrics = await json<{ items: Array<{ key: string; value: number }> }>(await t.request("/api/metrics", { cookie: owner }));
    expect(metrics.items.map((m) => m.key)).toContain("crm.open_pipeline_value");
  });
});

describe("public site and discovery", () => {
  it("server-renders the home page with SEO tags", async () => {
    const response = await t.request("/");
    const html = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("<h1>");
    expect(html).toContain('rel="canonical" href="http://localhost/"');
    expect(html).toContain('application/ld+json');
  });

  it("answers Markdown to agents", async () => {
    const response = await t.request("/", { headers: { accept: "text/markdown" } });
    expect(response.headers.get("content-type")).toContain("text/markdown");
  });

  it("serves sitemap, robots and llms.txt", async () => {
    expect(await (await t.request("/sitemap.xml")).text()).toContain("<loc>http://localhost/</loc>");
    expect(await (await t.request("/robots.txt")).text()).toContain("Disallow: /");
    expect(await (await t.request("/llms.txt")).text()).toContain("crm_list_contacts");
  });

  it("returns a real 404 page and JSON 404 for the API", async () => {
    expect((await t.request("/missing-page")).status).toBe(404);
    expect((await t.request("/api/nope", { cookie: owner })).status).toBe(404);
  });

  it("serves the dashboard shell with noindex", async () => {
    const response = await t.request("/app/crm/contacts");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});

describe("static assets", () => {
  it("adds security headers to immutable asset responses", async () => {
    const assets = await createTestApp({
      env: {
        ASSETS: {
          fetch: async () => {
            const response = await fetch("data:text/javascript,export{}");
            return response; // fetch() responses have immutable headers
          },
        } as unknown as Fetcher,
      },
    });
    const response = await assets.request("/src/app/main.tsx");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await assets.dispose();
  });
});

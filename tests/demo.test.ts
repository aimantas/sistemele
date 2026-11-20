import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_EMAIL } from "@/worker/auth/routes";
import { demoSeedStatements, resetDemoData, splitSql } from "@/worker/demo";
import { createTestApp, json, type TestApp } from "./helpers";

describe("demo mode", () => {
  let t: TestApp;
  beforeAll(async () => {
    // A key is set on purpose: a demo must still never send email.
    t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "demo", ADMIN_EMAILS: "", RESEND_API_KEY: "re_test_not_used" } });
  });
  afterAll(() => t.dispose());

  it("signs visitors in with one click as the demo owner, never by email", async () => {
    expect(await json(await t.request("/api/auth/session"))).toEqual({ user: null, demo: true });
    expect((await t.request("/api/auth/link", { method: "POST", json: { email: "owner@example.com" } })).status).toBe(400);

    const open = await t.request("/api/auth/demo", { method: "POST", json: {} });
    expect(open.status).toBe(200);
    const cookie = open.headers.get("set-cookie")?.split(";")[0] ?? "";
    const session = await json<{ user: { email: string; role: string } }>(await t.request("/api/auth/session", { cookie }));
    expect(session.user).toMatchObject({ email: DEMO_EMAIL, role: "owner" });

    // A second visitor shares the same account.
    await t.request("/api/auth/demo", { method: "POST", json: {} });
    const users = await t.db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(users?.n).toBe(1);

    // Cross-site requests are still refused.
    expect((await t.request("/api/auth/demo", { method: "POST", json: {}, headers: { origin: "https://evil.example" } })).status).toBe(403);
  });

  it("logs emails instead of sending them", async () => {
    const cookie = (await t.request("/api/auth/demo", { method: "POST", json: {} })).headers.get("set-cookie")?.split(";")[0] ?? "";
    const invite = await t.request("/api/users", { method: "POST", cookie, json: { email: "colleague@example.com", role: "member" } });
    expect(invite.status).toBeLessThan(300);
    await t.settle();
    const sent = await t.db.prepare("SELECT COUNT(*) AS n FROM email_log WHERE status <> 'logged'").first<{ n: number }>();
    expect(sent?.n).toBe(0);
    const app = await json<{ emailConfigured: boolean }>(await t.request("/api/app", { cookie }));
    expect(app.emailConfigured).toBe(false);
  });

  it("marks the public site as a demo and keeps it out of search engines", async () => {
    const home = await t.request("/");
    expect(home.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const homeHtml = await home.text();
    expect(homeHtml).toContain('<p class="demo-bar">Demo site with sample data. <a href="/app/login">Open the dashboard</a> · <a href="https://github.com/aimantas/sistemele">Get the code on GitHub</a></p>');
    expect(homeHtml).toContain('Made by <a href="https://aimantas.com">aimantas.com</a>');
    expect(await (await t.request("/robots.txt")).text()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("resets every table to the demo data", async () => {
    const cookie = (await t.request("/api/auth/demo", { method: "POST", json: {} })).headers.get("set-cookie")?.split(";")[0] ?? "";
    await t.request("/api/crm/contacts", { method: "POST", cookie, json: { name: "Visitor scribble" } });

    const result = await resetDemoData(t.db);
    expect(result.statements).toBe(demoSeedStatements().length);
    const count = async (sql: string) => (await t.db.prepare(sql).first<{ n: number }>())?.n;
    expect(await count("SELECT COUNT(*) AS n FROM contacts WHERE name = 'Visitor scribble'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM users")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM sessions")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM contacts")).toBeGreaterThan(3);
    expect(await count("SELECT COUNT(*) AS n FROM invoices")).toBeGreaterThan(0);
    expect(await count("SELECT COUNT(*) AS n FROM content_entries WHERE slug = 'home'")).toBe(0);
    // The old session is gone; a reset is idempotent.
    expect((await t.request("/api/auth/session", { cookie }).then((r) => json<{ user: unknown }>(r))).user).toBeNull();
    await resetDemoData(t.db);
    expect(await count("SELECT COUNT(*) AS n FROM contacts WHERE id = 'ct_demo_baltic'")).toBe(1);
    const home = await (await t.request("/")).text();
    expect(home).toContain("<h1 id=\"lp-title\">Don’t ask your agent to reinvent the wheel.</h1>");
    expect(home).toContain("One click signs you in as the demo owner.");
  });
});

describe("indexing", () => {
  it("lets search engines index a public demo with ALLOW_INDEXING, but never the dashboard", async () => {
    const t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "demo", ADMIN_EMAILS: "", ALLOW_INDEXING: "1" } });
    const robots = await (await t.request("/robots.txt")).text();
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /app");
    const home = await t.request("/");
    expect(home.headers.get("x-robots-tag")).toBeNull();
    expect(await home.text()).toContain('<meta name="robots" content="index, follow, max-image-preview:large"/>');
    expect((await t.request("/app/login")).headers.get("x-robots-tag")).toContain("noindex");
    await t.dispose();
  });

  it("keeps a demo without ALLOW_INDEXING out of search engines", async () => {
    const t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "demo", ADMIN_EMAILS: "" } });
    expect(await (await t.request("/robots.txt")).text()).toBe("User-agent: *\nDisallow: /\n");
    expect((await t.request("/")).headers.get("x-robots-tag")).toContain("noindex");
    await t.dispose();
  });
});

describe("outside demo mode", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.dispose());

  it("has no demo sign-in", async () => {
    expect((await t.request("/api/auth/demo", { method: "POST", json: {} })).status).toBe(404);
    expect(await json(await t.request("/api/auth/session"))).toEqual({ user: null, demo: false });
    const html = await (await t.request("/")).text();
    expect(html).not.toContain("demo-bar");
    expect(html).not.toContain("aimantas.com");
    expect(html).toContain('Runs on <a href="https://github.com/aimantas/sistemele">Sistemėlė</a>');
  });
});

describe("splitSql", () => {
  it("splits on semicolons outside quotes and comments", () => {
    expect(splitSql("-- note; here\nINSERT INTO t VALUES ('a;b', 'it''s');\nUPDATE t SET x = \"y;z\"; -- trailing;\n")).toEqual(["INSERT INTO t VALUES ('a;b', 'it''s')", 'UPDATE t SET x = "y;z"']);
    expect(splitSql("INSERT INTO t VALUES ('line one\n-- not a comment\n---');")).toEqual(["INSERT INTO t VALUES ('line one\n-- not a comment\n---')"]);
  });
});

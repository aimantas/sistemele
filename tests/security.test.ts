import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "../sistemele.config";
import { addDays, todayDate } from "@/shared/dates";
import { sendEmail } from "@/worker/email/send";
import { Db } from "@/worker/lib/db";
import { clientAddressKey } from "@/worker/lib/rate-limit";
import { sanitizeSvg } from "@/worker/lib/svg";
import { resetDemoData, scheduledDemoReset } from "@/worker/demo";
import type { Env } from "@/worker/env";
import { addUser, createTestApp, json, type TestApp } from "./helpers";

// Regression tests for the security review (docs/security.md). Each block
// pins one finding so it cannot quietly come back.

describe("secrets never reach deployed logs", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ env: { APP_ENV: "production", APP_URL: "https://example.com", RESEND_API_KEY: "" } });
  });
  afterAll(() => t.dispose());

  it("does not print email bodies (sign-in links) outside development", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await sendEmail(t.env as Env, new Db(t.db), { to: "owner@example.com", subject: "Sign in", template: "auth.sign_in_link", html: "<a href=x>x</a>", text: "https://example.com/app/login/verify?token=SECRET" });
      const printed = info.mock.calls.flat().join(" ");
      expect(printed).not.toContain("SECRET");
      expect(printed).toContain("not sent");
    } finally {
      info.mockRestore();
    }
  });

  it("strips line breaks from subjects", async () => {
    await sendEmail(t.env as Env, new Db(t.db), { to: "a@example.com", subject: "New request from x\r\nBcc: victim@example.com", template: "crm.inquiry", html: "", text: "" });
    const row = await t.db.prepare("SELECT subject FROM email_log WHERE to_address = 'a@example.com'").first<{ subject: string }>();
    expect(row?.subject).toBe("New request from x Bcc: victim@example.com");
  });
});

describe("demo mode cannot be switched on by accident", () => {
  it("needs APP_ENV=demo as well as DEMO_MODE", async () => {
    const t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "production", APP_URL: "https://example.com" } });
    try {
      expect((await t.request("/api/auth/demo", { method: "POST", json: {} })).status).toBe(404);
      expect(await json(await t.request("/api/auth/session"))).toMatchObject({ demo: false });
    } finally {
      await t.dispose();
    }
  });

  it("never wipes a database that holds no demo data", async () => {
    const t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "demo" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await t.db.prepare("INSERT INTO users (id, email, name, role) VALUES ('usr_keep', 'keep@example.com', 'Keep', 'owner')").run();
      await scheduledDemoReset(t.env as Env);
      expect(await t.db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = 'usr_keep'").first<{ n: number }>()).toEqual({ n: 1 });
      expect(error.mock.calls.flat().join(" ")).toContain("no demo data marker");
    } finally {
      error.mockRestore();
      await t.dispose();
    }
  });
});

describe("demo reset on a seeded database", () => {
  it("still resets a demo seeded before the marker existed", async () => {
    const t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "demo" } });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await resetDemoData(t.db);
      await t.db.prepare("DELETE FROM settings WHERE key = 'demo_data'").run();
      await t.db.prepare("INSERT INTO users (id, email, name, role) VALUES ('usr_visitor', 'visitor@example.com', 'Visitor', 'owner')").run();
      await scheduledDemoReset(t.env as Env);
      expect(await t.db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>()).toEqual({ n: 0 });
    } finally {
      info.mockRestore();
      await t.dispose();
    }
  });
});

describe("authentication", () => {
  let t: TestApp;
  let owner: string;
  beforeAll(async () => {
    t = await createTestApp();
    owner = await t.signIn();
  });
  afterAll(() => t.dispose());

  it("never falls back to the cookie when a bad Authorization header is sent", async () => {
    // A bogus bearer header used to skip the CSRF check and then sign in with the cookie.
    const bogus = "Bearer sk_not_a_real_token_000000000000";
    // From another site: the CSRF check applies again.
    expect((await t.request("/api/me", { method: "PATCH", cookie: owner, headers: { authorization: bogus, origin: "https://evil.example" }, json: { name: "Hijacked" } })).status).toBe(403);
    // Same site: the bad token is not replaced by the cookie.
    expect((await t.request("/api/me", { method: "PATCH", cookie: owner, headers: { authorization: bogus }, json: { name: "Hijacked" } })).status).toBe(401);
    expect(await json(await t.request("/api/me", { cookie: owner }))).toMatchObject({ user: { name: "owner" } });
  });

  it("keys IPv6 rate limits by /64 network", () => {
    expect(clientAddressKey("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(clientAddressKey("2001:0db8:0001:0002:bbbb:cccc:dddd:eeee")).toBe("2001:db8:1:2::/64");
    expect(clientAddressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientAddressKey("203.0.113.7")).toBe("203.0.113.7");
    expect(clientAddressKey(undefined)).toBe("local");
  });

  it("answers a website inquiry the same way for new and known addresses", async () => {
    const send = () => t.request("/api/public/crm/inquiries", { method: "POST", json: { name: "Rasa", email: "rasa@buyer.test", message: "Hello" } });
    expect(await json(await send())).toEqual({ ok: true });
    expect(await json(await send())).toEqual({ ok: true });
  });

  it("caps MCP batches", async () => {
    const token = await t.createToken(owner, "admin");
    const batch = Array.from({ length: 21 }, (_, id) => ({ jsonrpc: "2.0", id, method: "tools/list" }));
    const response = await t.request("/mcp", { method: "POST", token, json: batch });
    expect(response.status).toBe(400);
  });
});

describe("publishing and numbering rules", () => {
  let t: TestApp;
  let owner: string;
  let member: string;
  let contactId: string;
  const today = todayDate(config.timezone);
  const line = [{ description: "Frame", quantity: 1, unitPriceCents: 10_000, vatRateBps: 2100 }];

  beforeAll(async () => {
    t = await createTestApp();
    owner = await t.signIn();
    await addUser(t, "member@example.com", "member");
    member = await t.signIn("member@example.com");
    contactId = (await json<{ id: string }>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Buyer UAB", email: "buyer@example.com" } }))).id;
  });
  afterAll(() => t.dispose());

  const draft = async () => (await json<{ id: string }>(await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId, lines: line } }))).id;
  const issue = async (id: string, issueDate?: string) => t.request(`/api/invoices/${id}/issue`, { method: "POST", cookie: owner, json: issueDate ? { issueDate } : {} });

  it("keeps invoice numbers in date order", async () => {
    expect((await issue(await draft(), addDays(today, 1))).status).toBe(422);
    expect((await issue(await draft(), "2019-01-01")).status).toBe(422);
    expect((await issue(await draft())).status).toBe(200);
    // Earlier than the last issued invoice in the series.
    expect((await issue(await draft(), addDays(today, -2))).status).toBe(422);
  });

  it("refuses documents too large for safe integer maths", async () => {
    const huge = Array.from({ length: 20 }, () => ({ description: "Huge", quantity: 1_000_000, unitPriceCents: 1_000_000_000, vatRateBps: 0 }));
    expect((await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId, lines: huge } })).status).toBe(422);
  });

  it("lets only owners and admins change what the website shows", async () => {
    const product = { sku: "SEC-1", name: "Gate", kind: "product", unit: "pcs", priceCents: 10_000, vatRateBps: 2100 };
    expect((await t.request("/api/catalog/products", { method: "POST", cookie: member, json: { ...product, isPublic: true } })).status).toBe(403);
    const created = await json<{ id: string }>(await t.request("/api/catalog/products", { method: "POST", cookie: member, json: product }));
    expect((await t.request(`/api/catalog/products/${created.id}`, { method: "PATCH", cookie: member, json: { isPublic: true } })).status).toBe(403);
    expect((await t.request(`/api/catalog/products/${created.id}`, { method: "PATCH", cookie: owner, json: { isPublic: true } })).status).toBe(200);
    expect((await t.request(`/api/catalog/products/${created.id}`, { method: "PATCH", cookie: member, json: { priceCents: 1 } })).status).toBe(403);
    // Stock-only and internal fields stay open to members.
    expect((await t.request(`/api/catalog/products/${created.id}`, { method: "PATCH", cookie: member, json: { reorderPoint: 5 } })).status).toBe(200);
  });
});

describe("SVG logos", () => {
  const svg = (inner: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg"${attrs} viewBox="0 0 10 10">${inner}</svg>`;

  it("refuses markup the stripping cannot handle", () => {
    expect(() => sanitizeSvg(svg('<s:script>alert(1)</s:script>', ' xmlns:s="http://www.w3.org/2000/svg"'))).toThrow();
    expect(() => sanitizeSvg(svg('<a l:href="&#106;avascript:alert(1)"><rect width="1" height="1"/></a>', ' xmlns:l="http://www.w3.org/1999/xlink"'))).toThrow();
    expect(() => sanitizeSvg(svg('<style>@import "https://evil.example/x.css";</style>'))).toThrow();
    expect(() => sanitizeSvg(svg("<![CDATA[x]]>"))).toThrow();
  });

  it("still accepts ordinary logos", () => {
    expect(sanitizeSvg(svg('<rect width="10" height="10" fill="#123456"/>', ' xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"'))).toContain("<rect");
  });
});

describe("the public demo cannot host spam", () => {
  let t: TestApp;
  let cookie: string;
  beforeAll(async () => {
    t = await createTestApp({ env: { DEMO_MODE: "1", APP_ENV: "demo", ADMIN_EMAILS: "", ALLOW_INDEXING: "1" } });
    await resetDemoData(t.db);
    cookie = (await t.request("/api/auth/demo", { method: "POST", json: {} })).headers.get("set-cookie")?.split(";")[0] ?? "";
  });
  afterAll(() => t.dispose());

  it("keeps settings as seeded", async () => {
    expect((await t.request("/api/settings/business", { method: "PUT", cookie, json: { name: "Hacked" } })).status).toBe(403);
    expect((await t.request("/api/settings/branding", { method: "PUT", cookie, json: { brandColor: "#ff0000", surface: "cool", corners: "soft" } })).status).toBe(403);
  });

  it("serves what visitors publish as noindex, nofollow and off the sitemap and home page", async () => {
    const page = await json<{ id: string }>(await t.request("/api/content/entries", { method: "POST", cookie, json: { type: "page", title: "Verify your account", slug: "verify-account", body: "[Continue](https://evil.example)", menuOrder: 1 } }));
    expect((await t.request(`/api/content/entries/${page.id}/publish`, { method: "POST", cookie, json: {} })).status).toBe(200);
    const home = await json<{ id: string }>(await t.request("/api/content/entries", { method: "POST", cookie, json: { type: "page", title: "Hacked", slug: "home", body: "Spam" } }));
    await t.request(`/api/content/entries/${home.id}/publish`, { method: "POST", cookie, json: {} });

    const html = await (await t.request("/verify-account")).text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(html).toContain('<a href="https://evil.example" rel="nofollow ugc noopener">Continue</a>');
    expect(await (await t.request("/sitemap.xml")).text()).not.toContain("verify-account");
    const landing = await (await t.request("/")).text();
    expect(landing).not.toContain("Hacked");
    expect(landing).not.toContain('href="/verify-account"');
    // Seed content is still indexable.
    expect(await (await t.request("/about")).text()).toContain('content="index, follow');
  });

  it("warns that the demo contact form is public", async () => {
    expect(await (await t.request("/contact")).text()).toContain("anyone who opens the demo can read what you send here");
  });
});

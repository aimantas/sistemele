import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { brandTokens, contrastRatio, defaultBranding } from "@/shared/branding";
import { addUser, createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
});
afterAll(() => t.dispose());

const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>';

describe("brand settings", () => {
  it("saves colours and a sanitised SVG logo", async () => {
    const evil = '<?xml version="1.0"?><svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect width="10" height="10" style="fill:url(https://evil.test/x)"/></a><foreignObject><div>x</div></foreignObject><use href="https://evil.test/a.svg#x"/><use href="#ok"/></svg>';
    const response = await t.request("/api/settings/branding", { method: "PUT", cookie: owner, json: { brandColor: "#1D5B8F", surface: "cool", corners: "round", logoSvg: evil } });
    expect(response.status).toBe(200);
    const { branding, logoUrl } = await json<{ branding: { brandColor: string; logoSvg: string }; logoUrl: string }>(response);
    expect(branding.brandColor).toBe("#1d5b8f");
    expect(branding.logoSvg).not.toMatch(/script|onload|javascript:|foreignObject|evil\.test/iu);
    expect(branding.logoSvg).toContain('href="#ok"');
    expect(branding.logoSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(logoUrl).toMatch(/^\/brand\/logo\.svg\?v=[0-9a-f]{12}$/u);
  });

  it("rejects non-SVG input and bad colours", async () => {
    const notSvg = await t.request("/api/settings/branding", { method: "PUT", cookie: owner, json: { ...defaultBranding, logoSvg: "<html><body>hi</body></html>" } });
    expect(notSvg.status).toBe(400);
    const badColor = await t.request("/api/settings/branding", { method: "PUT", cookie: owner, json: { ...defaultBranding, brandColor: "green" } });
    expect(badColor.status).toBe(422);
  });

  it("lets only admins change the brand", async () => {
    await addUser(t, "member@brand.test", "member");
    const member = await t.signIn("member@brand.test");
    expect((await t.request("/api/settings/branding", { method: "PUT", cookie: member, json: defaultBranding })).status).toBe(403);
    expect((await t.request("/api/settings/branding", { cookie: member })).status).toBe(200);
  });

  it("serves the logo safely, the theme CSS and public brand info", async () => {
    await t.request("/api/settings/branding", { method: "PUT", cookie: owner, json: { brandColor: "#a3472b", surface: "warm", corners: "sharp", logoSvg: logo } });
    const svg = await t.request("/brand/logo.svg");
    expect(svg.headers.get("content-type")).toContain("image/svg+xml");
    expect(svg.headers.get("content-security-policy")).toContain("sandbox");
    expect(await svg.text()).toContain("<rect");

    const css = await (await t.request("/brand/theme")).text();
    expect(css).toContain("--primary:#a3472b");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--radius:0.25rem");

    const info = await json<{ logoUrl: string; brandColor: string }>(await t.request("/brand/info.json"));
    expect(info).toMatchObject({ brandColor: "#a3472b" });
    expect(info.logoUrl).toMatch(/^\/brand\/logo\.svg\?v=/u);

    const home = await (await t.request("/")).text();
    expect(home).toContain("--primary:#a3472b");
    expect(home).toContain('class="brand-logo"');
  });

  it("puts the logo on public invoice pages", async () => {
    await t.request("/api/settings/branding", { method: "PUT", cookie: owner, json: { ...defaultBranding, logoSvg: logo } });
    const contact = await json<{ id: string }>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Logo Buyer", email: "buyer@logo.test" } }));
    const invoice = await json<{ id: string }>(
      await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId: contact.id, lines: [{ description: "Work", quantity: 1, unitPriceCents: 10000, vatRateBps: 2100 }] } }),
    );
    const issued = await json<{ publicUrl?: string }>(await t.request(`/api/invoices/${invoice.id}/issue`, { method: "POST", cookie: owner, json: { send: true } }));
    const sent = issued.publicUrl ? issued : await json<{ publicUrl: string }>(await t.request(`/api/invoices/${invoice.id}/send`, { method: "POST", cookie: owner, json: {} }));
    const page = await (await t.request(new URL(sent.publicUrl!).pathname)).text();
    expect(page).toContain('class="doc-logo"');
  });

  it("returns 404 when no logo is set", async () => {
    await t.request("/api/settings/branding", { method: "PUT", cookie: owner, json: { ...defaultBranding, logoSvg: null } });
    expect((await t.request("/brand/logo.svg")).status).toBe(404);
  });
});

describe("colour tokens", () => {
  it("derives readable text-on-brand colours", () => {
    expect(brandTokens({ ...defaultBranding, brandColor: "#1f5f4a" }).brandInk).toBe("#ffffff");
    expect(brandTokens({ ...defaultBranding, brandColor: "#f5d90a" }).brandInk).toBe("#111111");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/shared/dates";
import { documentTotals } from "@/shared/money";
import type { Contact, ContactDetail, Deal } from "@/modules/crm/shared/schema";
import type { Quote, QuoteDetail, QuoteSendResult } from "@/modules/quotes/shared/schema";
import { createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;
let contact: Contact;

const line = { description: "Steel mesh 6 mm", quantity: 2.5, unitPriceCents: 1999, vatRateBps: 2100, discountBps: 1000 };
const form = (path: string) => t.request(path, { method: "POST", body: new URLSearchParams(), headers: { "content-type": "application/x-www-form-urlencoded" } });

async function newDeal(title: string): Promise<Deal> {
  return json<Deal>(await t.request("/api/crm/deals", { method: "POST", cookie: owner, json: { contactId: contact.id, title, valueCents: 0 } }));
}

async function createQuote(body: Record<string, unknown> = {}): Promise<QuoteDetail> {
  const response = await t.request("/api/quotes", { method: "POST", cookie: owner, json: { contactId: contact.id, lines: [line], ...body } });
  expect(response.status).toBe(201);
  return json<QuoteDetail>(response);
}

async function send(id: string, message?: string): Promise<QuoteSendResult> {
  const response = await t.request(`/api/quotes/${id}/send`, { method: "POST", cookie: owner, json: message ? { message } : {} });
  expect(response.status).toBe(200);
  return json<QuoteSendResult>(response);
}

const pathOf = (url: string) => new URL(url).pathname;
const tokenOf = (url: string) => pathOf(url).split("/").pop()!;
const getQuote = async (id: string) => json<QuoteDetail>(await t.request(`/api/quotes/${id}`, { cookie: owner }));

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
  await t.request("/api/settings/business", { method: "PUT", cookie: owner, json: { name: "Acme", email: "sales@acme.test", defaultVatRateBps: 2100 } });
  contact = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Baltic Build UAB", email: "orders@balticbuild.test", city: "Kaunas" } }));
});
afterAll(() => t.dispose());

describe("drafts", () => {
  it("prices lines on the server and ignores client totals", async () => {
    const quote = await createQuote({
      lines: [line, { description: "Delivery", quantity: 1, unitPriceCents: 5000 }],
      subtotalCents: 1,
      vatCents: 1,
      totalCents: 999_999,
    });
    // 2.5 × 19.99 − 10% = 44.98; + 50.00 delivery (default 21% VAT) = 94.98 net; VAT 19.95.
    expect(quote).toMatchObject({ status: "draft", subtotalCents: 9498, vatCents: 1995, totalCents: 11493, currency: "EUR", contactName: "Baltic Build UAB" });
    expect(quote.lines.map((l) => [l.subtotalCents, l.vatRateBps, l.position])).toEqual([
      [4498, 2100, 1],
      [5000, 2100, 2],
    ]);
    expect(quote.number).toMatch(/^Q-\d{4}-0001$/u);
    expect(quote.validUntil).toBe(addDays(quote.issueDate, 30));
    const stored = await t.db.prepare("SELECT total_cents FROM quotes WHERE id = ?").bind(quote.id).first<{ total_cents: number }>();
    expect(stored?.total_cents).toBe(11493);
  });

  it("numbers quotes sequentially", async () => {
    const a = await createQuote();
    const b = await createQuote();
    const seq = (n: string) => Number(n.split("-").pop());
    expect(seq(b.number)).toBe(seq(a.number) + 1);
  });

  it("returns field issues for invalid lines and contacts", async () => {
    const bad = await t.request("/api/quotes", { method: "POST", cookie: owner, json: { contactId: contact.id, lines: [{ description: "", quantity: 0, unitPriceCents: -1 }] } });
    expect(bad.status).toBe(422);
    const issues = (await json<{ error: { issues: Record<string, string> } }>(bad)).error.issues;
    expect(Object.keys(issues)).toEqual(expect.arrayContaining(["lines.0.description", "lines.0.quantity", "lines.0.unitPriceCents"]));

    const empty = await json<{ error: { issues: Record<string, string> } }>(await t.request("/api/quotes", { method: "POST", cookie: owner, json: { contactId: contact.id, lines: [] } }));
    expect(empty.error.issues.lines).toBeDefined();

    const unknown = await t.request("/api/quotes", { method: "POST", cookie: owner, json: { contactId: "ct_missing", lines: [line] } });
    expect(unknown.status).toBe(422);
    expect((await json<{ error: { issues: Record<string, string> } }>(unknown)).error.issues.contactId).toBeDefined();

    const dates = await t.request("/api/quotes", { method: "POST", cookie: owner, json: { contactId: contact.id, issueDate: "2026-05-10", validUntil: "2026-05-01", lines: [line] } });
    expect((await json<{ error: { issues: Record<string, string> } }>(dates)).error.issues.validUntil).toBeDefined();
  });

  it("edits and deletes drafts only", async () => {
    const quote = await createQuote();
    const edited = await t.request(`/api/quotes/${quote.id}`, { method: "PATCH", cookie: owner, json: { notes: "Delivery in 2 weeks", lines: [{ ...line, quantity: 10, discountBps: 0 }], totalCents: 1 } });
    expect(edited.status).toBe(200);
    expect(await json<QuoteDetail>(edited)).toMatchObject({ notes: "Delivery in 2 weeks", subtotalCents: 19990, vatCents: 4198, totalCents: 24188 });

    await send(quote.id);
    expect((await t.request(`/api/quotes/${quote.id}`, { method: "PATCH", cookie: owner, json: { notes: "x" } })).status).toBe(409);
    expect((await t.request(`/api/quotes/${quote.id}`, { method: "DELETE", cookie: owner })).status).toBe(409);

    const revised = await json<QuoteDetail>(await t.request(`/api/quotes/${quote.id}/revise`, { method: "POST", cookie: owner }));
    expect(revised.status).toBe("draft");
    expect((await t.request(`/api/quotes/${quote.id}`, { method: "DELETE", cookie: owner })).status).toBe(200);
    expect((await t.request(`/api/quotes/${quote.id}`, { cookie: owner })).status).toBe(404);
  });

  it("duplicates a quote as a new draft", async () => {
    const source = await createQuote({ notes: "Original", terms: "50% upfront" });
    const copy = await json<QuoteDetail>(await t.request(`/api/quotes/${source.id}/duplicate`, { method: "POST", cookie: owner }));
    expect(copy.id).not.toBe(source.id);
    expect(copy.number).not.toBe(source.number);
    expect(copy).toMatchObject({ status: "draft", notes: "Original", terms: "50% upfront", totalCents: source.totalCents });
  });
});

describe("sending and the customer link", () => {
  it("emails the customer, and the link stops working after a revision", async () => {
    const quote = await createQuote();
    const sent = await send(quote.id, "Hi! Here is the price we discussed.");
    expect(sent.quote.status).toBe("sent");
    expect(sent.publicUrl).toMatch(/^http:\/\/localhost\/q\/[A-Za-z0-9_-]{40,}$/u);

    const emails = await t.db.prepare("SELECT to_address, template, related_id FROM email_log WHERE template = 'quotes.sent' AND related_id = ?").bind(quote.id).all();
    expect(emails.results).toEqual([{ to_address: "orders@balticbuild.test", template: "quotes.sent", related_id: quote.id }]);
    const stored = await t.db.prepare("SELECT public_token_hash FROM quotes WHERE id = ?").bind(quote.id).first<{ public_token_hash: string }>();
    expect(stored?.public_token_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(stored?.public_token_hash).not.toContain(tokenOf(sent.publicUrl));

    const page = await t.request(pathOf(sent.publicUrl));
    expect(page.status).toBe(200);
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const html = await page.text();
    expect(html).toContain(quote.number);
    expect(html).toContain(`action="/api/public/quotes/${tokenOf(sent.publicUrl)}/accept"`);

    const markdown = await t.request(pathOf(sent.publicUrl), { headers: { accept: "text/markdown" } });
    expect(await markdown.text()).toContain(`# Quote ${quote.number}`);

    await t.request(`/api/quotes/${quote.id}/revise`, { method: "POST", cookie: owner });
    const old = await t.request(pathOf(sent.publicUrl));
    expect(old.status).toBe(404);
    expect(old.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const again = await send(quote.id);
    expect(again.publicUrl).not.toBe(sent.publicUrl);
    expect((await t.request(pathOf(again.publicUrl))).status).toBe(200);
  });

  it("refuses to send without a customer email", async () => {
    const noEmail = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Walk-in customer" } }));
    const quote = await createQuote({ contactId: noEmail.id });
    const response = await t.request(`/api/quotes/${quote.id}/send`, { method: "POST", cookie: owner });
    expect(response.status).toBe(422);
    expect((await getQuote(quote.id)).status).toBe("draft");
  });

  it("returns 404 for unknown links", async () => {
    const unknown = "A".repeat(43);
    const page = await t.request(`/q/${unknown}`);
    expect(page.status).toBe(404);
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect((await t.request("/q/short")).status).toBe(404);
    expect((await t.request(`/api/public/quotes/${unknown}/accept`, { method: "POST", json: {} })).status).toBe(404);
  });
});

describe("customer answers", () => {
  it("accepts through the HTML form, wins the deal and notifies the business", async () => {
    const deal = await newDeal("Warehouse racks");
    const quote = await createQuote({ dealId: deal.id });
    const { publicUrl } = await send(quote.id);
    expect((await json<Deal>(await t.request(`/api/crm/deals/${deal.id}`, { cookie: owner }))).stage).toBe("proposal");

    const token = tokenOf(publicUrl);
    const response = await form(`/api/public/quotes/${token}/accept`);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/q/${token}?done=accepted`);
    await t.settle();

    const accepted = await getQuote(quote.id);
    expect(accepted.status).toBe("accepted");
    expect(accepted.respondedAt).not.toBeNull();
    const wonDeal = await json<Deal>(await t.request(`/api/crm/deals/${deal.id}`, { cookie: owner }));
    expect(wonDeal).toMatchObject({ stage: "won", valueCents: quote.totalCents });
    const timeline = await json<ContactDetail>(await t.request(`/api/crm/contacts/${contact.id}`, { cookie: owner }));
    expect(timeline.activities.map((a) => a.body)).toEqual(expect.arrayContaining([expect.stringContaining(`Quote ${quote.number} accepted`), `Quote ${quote.number} sent.`]));

    const notice = await t.db.prepare("SELECT to_address FROM email_log WHERE template = 'quotes.accepted' AND related_id = ?").bind(quote.id).all();
    expect(notice.results).toEqual([{ to_address: "sales@acme.test" }]);

    const page = await (await t.request(`/q/${token}?done=accepted`)).text();
    expect(page).toContain("Thank you. You accepted this quote.");
    expect(page).not.toContain("/accept\"");

    // Accepted quotes are locked.
    expect((await t.request(`/api/quotes/${quote.id}/revise`, { method: "POST", cookie: owner })).status).toBe(409);
  });

  it("accepts JSON from agents and is idempotent", async () => {
    const deal = await newDeal("Gate");
    const quote = await createQuote({ dealId: deal.id });
    const token = tokenOf((await send(quote.id)).publicUrl);
    const first = await t.request(`/api/public/quotes/${token}/accept`, { method: "POST", json: {} });
    expect(first.status).toBe(200);
    expect(await json(first)).toMatchObject({ ok: true, status: "accepted", number: quote.number });
    expect((await t.request(`/api/public/quotes/${token}/accept`, { method: "POST", json: {} })).status).toBe(200);
    expect((await t.request(`/api/public/quotes/${token}/decline`, { method: "POST", json: {} })).status).toBe(409);
    expect((await json<Deal>(await t.request(`/api/crm/deals/${deal.id}`, { cookie: owner }))).stage).toBe("won");
  });

  it("declines", async () => {
    const quote = await createQuote();
    const token = tokenOf((await send(quote.id)).publicUrl);
    const response = await form(`/api/public/quotes/${token}/decline`);
    expect(response.headers.get("location")).toBe(`/q/${token}?done=declined`);
    expect((await getQuote(quote.id)).status).toBe("declined");
    const timeline = await json<ContactDetail>(await t.request(`/api/crm/contacts/${contact.id}`, { cookie: owner }));
    expect(timeline.activities.map((a) => a.body)).toContain(`Quote ${quote.number} declined.`);
  });

  it("reports expired quotes and blocks acceptance", async () => {
    const quote = await createQuote();
    const token = tokenOf((await send(quote.id)).publicUrl);
    await t.db.prepare("UPDATE quotes SET valid_until = '2020-01-31' WHERE id = ?").bind(quote.id).run();

    expect((await getQuote(quote.id)).status).toBe("expired");
    const expired = await json<{ items: Quote[] }>(await t.request("/api/quotes?status=expired", { cookie: owner }));
    expect(expired.items.map((q) => q.id)).toContain(quote.id);
    const sent = await json<{ items: Quote[] }>(await t.request("/api/quotes?status=sent", { cookie: owner }));
    expect(sent.items.map((q) => q.id)).not.toContain(quote.id);

    expect((await t.request(`/api/public/quotes/${token}/accept`, { method: "POST", json: {} })).status).toBe(409);
    const viaForm = await form(`/api/public/quotes/${token}/accept`);
    expect(viaForm.headers.get("location")).toBe(`/q/${token}?error=closed`);
    expect(await (await t.request(`/q/${token}`)).text()).toContain("This quote expired on");
    expect((await t.request(`/api/quotes/${quote.id}/send`, { method: "POST", cookie: owner })).status).toBe(422);
    expect((await getQuote(quote.id)).status).toBe("expired");
  });

  it("lets staff record an answer given by phone", async () => {
    const quote = await createQuote();
    await send(quote.id);
    const marked = await json<QuoteDetail>(await t.request(`/api/quotes/${quote.id}/mark`, { method: "POST", cookie: owner, json: { status: "declined" } }));
    expect(marked.status).toBe("declined");
    expect((await t.request(`/api/quotes/${quote.id}/mark`, { method: "POST", cookie: owner, json: { status: "accepted" } })).status).toBe(409);
  });
});

describe("lists, search, metrics and agents", () => {
  it("filters, searches and paginates", async () => {
    const drafts = await json<{ items: Quote[]; total: number }>(await t.request("/api/quotes?status=draft&limit=2", { cookie: owner }));
    expect(drafts.items).toHaveLength(2);
    expect(drafts.total).toBeGreaterThan(2);
    expect(drafts.items.every((q) => q.status === "draft")).toBe(true);

    const byName = await json<{ total: number }>(await t.request("/api/quotes?q=baltic", { cookie: owner }));
    const all = await json<{ total: number }>(await t.request("/api/quotes", { cookie: owner }));
    expect(byName.total).toBe(all.total - 1); // the walk-in customer's draft
    const search = await json<{ items: Array<{ module: string; href: string }> }>(await t.request("/api/search?q=Q-", { cookie: owner }));
    expect(search.items.find((item) => item.module === "quotes")?.href).toMatch(/^\/app\/quotes\/qt_/u);
  });

  it("exposes metrics", async () => {
    const metrics = await json<{ items: Array<{ key: string; value: number; hint?: string }> }>(await t.request("/api/metrics?keys=quotes.open_value,quotes.acceptance_rate_90d", { cookie: owner }));
    const open = metrics.items.find((m) => m.key === "quotes.open_value");
    const rate = metrics.items.find((m) => m.key === "quotes.acceptance_rate_90d");
    expect(open?.value).toBeGreaterThan(0);
    expect(open?.hint).toMatch(/awaiting answer$/u);
    // 2 accepted, 2 declined (one online, one by phone).
    expect(rate?.value).toBeCloseTo(0.5);
  });

  it("offers MCP tools that create and read quotes", async () => {
    const token = await t.createToken(owner);
    const rpc = async (method: string, params: Record<string, unknown> = {}) =>
      json<{ result: { tools?: Array<{ name: string }>; structuredContent?: QuoteDetail; isError?: boolean } }>(await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method, params } }));

    const names = (await rpc("tools/list")).result.tools!.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["quotes_list", "quotes_get", "quotes_create", "quotes_update_draft", "quotes_send", "quotes_mark"]));

    const created = await rpc("tools/call", { name: "quotes_create", arguments: { contactId: contact.id, lines: [{ description: "Consulting", quantity: 2, unitPriceCents: 10000 }] } });
    expect(created.result.isError).toBeUndefined();
    expect(created.result.structuredContent).toMatchObject({ status: "draft", subtotalCents: 20000, vatCents: 4200, totalCents: 24200 });
    const updated = await rpc("tools/call", { name: "quotes_update_draft", arguments: { quoteId: created.result.structuredContent!.id, changes: { terms: "Net 14" } } });
    expect(updated.result.structuredContent?.terms).toBe("Net 14");
  });
});

describe("demo seed", () => {
  it("stores totals that match the lines and continues numbering", async () => {
    const seeded = await createTestApp();
    try {
      const statements = ["01_core.sql", "02_crm.sql", "04_quotes.sql"].flatMap((file) =>
        readFileSync(join(process.cwd(), "seed", file), "utf8")
          .split("\n")
          .filter((row) => !row.trim().startsWith("--"))
          .join("\n")
          .split(/;\s*(?:\n|$)/u)
          .map((sql) => sql.trim())
          .filter(Boolean),
      );
      await seeded.db.batch(statements.map((sql) => seeded.db.prepare(sql)));
      const cookie = await seeded.signIn();

      const list = await json<{ items: Quote[] }>(await seeded.request("/api/quotes", { cookie }));
      expect(list.items.map((q) => [q.id, q.status]).sort()).toEqual([
        ["qt_demo_1", "sent"],
        ["qt_demo_2", "accepted"],
        ["qt_demo_3", "draft"],
      ]);
      for (const { id } of list.items) {
        const quote = await json<QuoteDetail>(await seeded.request(`/api/quotes/${id}`, { cookie }));
        const totals = documentTotals(quote.lines);
        expect([quote.subtotalCents, quote.vatCents, quote.totalCents], quote.number).toEqual([totals.subtotalCents, totals.vatCents, totals.totalCents]);
        for (const line of quote.lines) expect(line.subtotalCents).toBe(documentTotals([line]).subtotalCents);
      }

      const next = await json<QuoteDetail>(await seeded.request("/api/quotes", { method: "POST", cookie, json: { contactId: "ct_demo_ona", lines: [line] } }));
      expect(next.number).toMatch(/-0004$/u);
    } finally {
      await seeded.dispose();
    }
  });
});

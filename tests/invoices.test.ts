import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../sistemele.config";
import { addUser, createTestApp, json, type TestApp } from "./helpers";
import type { Contact, ContactDetail } from "@/modules/crm/shared/schema";
import type { SistemeleEvents } from "@/modules/events";
import type { Invoice, InvoiceActionResult, InvoiceDetail } from "@/modules/invoices/shared/schema";
import { issueInvoice } from "@/modules/invoices/server/service";
import { serverModules } from "@/modules/server";
import type { ServerModule } from "@/modules/types.server";
import type { SessionUser } from "@/shared/auth";
import { addDays, todayDate } from "@/shared/dates";
import { createModuleContext } from "@/worker/context";

/** Records the events invoices emit, the way catalog and CRM would receive them. */
const events: Array<{ name: string; payload: unknown }> = [];
const spy: ServerModule = {
  id: "spy",
  name: "Spy",
  description: "Test listener",
  events: {
    "invoice.issued": async (payload) => void events.push({ name: "invoice.issued", payload }),
    "invoice.paid": async (payload) => void events.push({ name: "invoice.paid", payload }),
    "invoice.voided": async (payload) => void events.push({ name: "invoice.voided", payload }),
  },
};

let t: TestApp;
let owner: string;
let member: string;
let customer: Contact;
let noEmail: Contact;
const today = todayDate(config.timezone);
const year = today.slice(0, 4);
const IBAN = "LT12 1000 0111 0100 1000";

const lines = [
  { description: "Steel frame", quantity: 2, unitPriceCents: 10_000, vatRateBps: 2100 },
  { description: "Installation", quantity: 1.5, unitPriceCents: 4_000, vatRateBps: 2100, discountBps: 1000 },
];

async function createDraft(body: Record<string, unknown> = {}): Promise<InvoiceDetail> {
  const response = await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId: customer.id, lines, ...body } });
  expect(response.status).toBe(201);
  return json<InvoiceDetail>(response);
}

async function issue(id: string, body: Record<string, unknown> = {}): Promise<Response> {
  return t.request(`/api/invoices/${id}/issue`, { method: "POST", cookie: owner, json: body });
}

async function issued(body: Record<string, unknown> = {}): Promise<InvoiceDetail> {
  const draft = await createDraft();
  const response = await issue(draft.id, body);
  expect(response.status).toBe(200);
  return (await json<InvoiceActionResult>(response)).invoice;
}

beforeAll(async () => {
  t = await createTestApp({ modules: [...serverModules, spy] });
  owner = await t.signIn();
  await addUser(t, "member@example.com", "member");
  member = await t.signIn("member@example.com");
  await t.request("/api/settings/business", {
    method: "PUT",
    cookie: owner,
    json: { name: "Northwind", legalName: "Northwind Workshop UAB", email: "sales@northwind.test", bankName: "Example Bank", iban: IBAN, paymentTermsDays: 14 },
  });
  customer = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Baltic Build UAB", email: "orders@balticbuild.test", vatCode: "LT111111111", city: "Kaunas" } }));
  noEmail = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "No Email Co" } }));
});
afterAll(() => t.dispose());

describe("numbering", () => {
  it("numbers invoices only when issued, sequentially and without gaps", async () => {
    const first = await createDraft();
    const second = await createDraft();
    const third = await createDraft();
    expect([first.number, second.number, third.number]).toEqual([null, null, null]);

    const a = await json<InvoiceActionResult>(await issue(first.id));
    expect(a.invoice).toMatchObject({ number: `INV-${year}-0001`, status: "issued", issueDate: today, dueDate: addDays(today, 14) });
    expect(a.invoice.seller).toMatchObject({ name: "Northwind Workshop UAB", bank: { name: "Example Bank", iban: IBAN } });
    expect(a.invoice.buyer).toMatchObject({ name: "Baltic Build UAB", vatCode: "LT111111111", email: "orders@balticbuild.test" });

    const b = await json<InvoiceActionResult>(await issue(second.id, { issueDate: today, dueDate: addDays(today, 30) }));
    expect(b.invoice).toMatchObject({ number: `INV-${year}-0002`, dueDate: addDays(today, 30) });

    // Issuing twice is refused and neither burns a number nor renumbers the invoice.
    const again = await issue(first.id);
    expect(again.status).toBe(409);
    expect((await json<InvoiceDetail>(await t.request(`/api/invoices/${first.id}`, { cookie: owner }))).number).toBe(`INV-${year}-0001`);
    expect((await json<InvoiceDetail>(await t.request(`/api/invoices/${third.id}`, { cookie: owner }))).number).toBeNull();

    const c = await json<InvoiceActionResult>(await issue(third.id));
    expect(c.invoice.number).toBe(`INV-${year}-0003`);
    const sequences = await t.db.prepare("SELECT name, value FROM sequences ORDER BY name").all();
    expect(sequences.results).toEqual([{ name: `INV-${year}`, value: 3 }]);

    const issuedEvent = events.find((event) => event.name === "invoice.issued" && (event.payload as SistemeleEvents["invoice.issued"]).invoiceId === first.id);
    expect(issuedEvent?.payload).toEqual({
      invoiceId: first.id,
      contactId: customer.id,
      number: `INV-${year}-0001`,
      totalCents: first.totalCents,
      lines: [
        { productId: null, quantity: 2 },
        { productId: null, quantity: 1.5 },
      ],
    });
  });

  it("issues a draft once when two requests race, consuming one number", async () => {
    const draft = await createDraft();
    const counter = () => t.db.prepare("SELECT value FROM sequences WHERE name = ?").bind(`INV-${year}`).first<{ value: number }>();
    const before = (await counter())?.value ?? 0;

    // Hold both issue calls at db.batch until both have passed the draft check,
    // so only the in-batch guard can stop the second one.
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const gated = new Proxy(t.db, {
      get(target, property) {
        if (property === "batch")
          return async (statements: D1PreparedStatement[]) => {
            if (++arrived === 2) release();
            await gate;
            return target.batch(statements);
          };
        const value = Reflect.get(target, property) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const user = await t.db.prepare("SELECT id, email, name, role FROM users WHERE email = 'owner@example.com'").first<SessionUser>();
    const ctx = createModuleContext({ env: { ...t.env, DB: gated }, user: { ...user!, via: "session" }, modules: serverModules });
    const results = await Promise.allSettled([issueInvoice(ctx, draft.id), issueInvoice(ctx, draft.id)]);

    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect((await counter())?.value).toBe(before + 1);
    expect((await json<InvoiceDetail>(await t.request(`/api/invoices/${draft.id}`, { cookie: owner }))).number).toBe(`INV-${year}-${String(before + 1).padStart(4, "0")}`);
  });

  it("rejects a due date before the issue date", async () => {
    const draft = await createDraft();
    const response = await issue(draft.id, { issueDate: today, dueDate: addDays(today, -1) });
    expect(response.status).toBe(422);
    expect((await json<{ error: { issues: Record<string, string> } }>(response)).error.issues).toHaveProperty("dueDate");
    await t.request(`/api/invoices/${draft.id}`, { method: "DELETE", cookie: owner });
  });
});

describe("drafts", () => {
  it("computes totals on the server and ignores client totals", async () => {
    const draft = await createDraft({ totalCents: 1, subtotalCents: 1, notes: "Delivery to site 4." });
    // 2 × 100.00 + 1.5 × 40.00 − 10 % = 200.00 + 54.00 net; VAT 21 % of 254.00 = 53.34
    expect(draft).toMatchObject({ status: "draft", number: null, subtotalCents: 25_400, vatCents: 5_334, totalCents: 30_734, amountDueCents: 30_734, notes: "Delivery to site 4." });
    expect(draft.lines.map((line) => line.subtotalCents)).toEqual([20_000, 5_400]);
    expect(draft.vatGroups).toEqual([{ rateBps: 2100, baseCents: 25_400, vatCents: 5_334 }]);
  });

  it("validates lines and the contact with field messages", async () => {
    const response = await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId: "", lines: [{ description: "", quantity: 0, unitPriceCents: 100, vatRateBps: 2100 }] } });
    expect(response.status).toBe(422);
    const { error } = await json<{ error: { issues: Record<string, string> } }>(response);
    expect(Object.keys(error.issues)).toEqual(expect.arrayContaining(["contactId", "lines.0.description", "lines.0.quantity"]));

    const missing = await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId: "ct_missing", lines } });
    expect(missing.status).toBe(422);
  });

  it("changes only the fields a PATCH sends", async () => {
    const draft = await createDraft({ notes: "Keep me", dueDate: addDays(today, 20) });
    const patched = await json<InvoiceDetail>(await t.request(`/api/invoices/${draft.id}`, { method: "PATCH", cookie: owner, json: { dueDate: addDays(today, 25) } }));
    expect(patched).toMatchObject({ dueDate: addDays(today, 25), notes: "Keep me", contactId: customer.id, totalCents: draft.totalCents });
    expect(patched.lines.map((line) => line.description)).toEqual(draft.lines.map((line) => line.description));

    const notesOnly = await json<InvoiceDetail>(await t.request(`/api/invoices/${draft.id}`, { method: "PATCH", cookie: owner, json: { notes: "Changed" } }));
    expect(notesOnly).toMatchObject({ notes: "Changed", dueDate: addDays(today, 25), totalCents: draft.totalCents });
    await t.request(`/api/invoices/${draft.id}`, { method: "DELETE", cookie: owner });
  });

  it("edits and deletes drafts, but locks issued invoices", async () => {
    const draft = await createDraft();
    const edited = await json<InvoiceDetail>(
      await t.request(`/api/invoices/${draft.id}`, { method: "PATCH", cookie: owner, json: { notes: "Updated", lines: [{ description: "One item", quantity: 1, unitPriceCents: 1_000, vatRateBps: 900 }] } }),
    );
    expect(edited).toMatchObject({ notes: "Updated", subtotalCents: 1_000, vatCents: 90, totalCents: 1_090 });
    expect(edited.lines).toHaveLength(1);

    expect((await t.request(`/api/invoices/${draft.id}`, { method: "DELETE", cookie: owner })).status).toBe(200);
    expect((await t.request(`/api/invoices/${draft.id}`, { cookie: owner })).status).toBe(404);

    const invoice = await issued();
    const patch = await t.request(`/api/invoices/${invoice.id}`, { method: "PATCH", cookie: owner, json: { notes: "Sneaky change" } });
    expect(patch.status).toBe(409);
    expect((await t.request(`/api/invoices/${invoice.id}`, { method: "DELETE", cookie: owner })).status).toBe(409);
    expect((await json<InvoiceDetail>(await t.request(`/api/invoices/${invoice.id}`, { cookie: owner }))).notes).toBe("");
  });
});

describe("payments", () => {
  it("keeps partly paid invoices issued, marks them paid in full and writes the CRM timeline", async () => {
    const invoice = await issued();
    const pay = (amountCents: number) => t.request(`/api/invoices/${invoice.id}/payments`, { method: "POST", cookie: owner, json: { amountCents, paidOn: today, method: "bank_transfer", reference: "Bank 1" } });

    const partial = await json<InvoiceDetail>(await pay(10_000));
    expect(partial).toMatchObject({ status: "issued", paidCents: 10_000, amountDueCents: invoice.totalCents - 10_000 });

    const over = await pay(invoice.totalCents);
    expect(over.status).toBe(422);
    expect((await json<{ error: { issues: Record<string, string> } }>(over)).error.issues).toHaveProperty("amountCents");

    const full = await json<InvoiceDetail>(await pay(invoice.totalCents - 10_000));
    expect(full).toMatchObject({ status: "paid", paidCents: invoice.totalCents, amountDueCents: 0 });
    expect(full.paidAt).not.toBeNull();
    expect(full.payments).toHaveLength(2);
    expect((await pay(100)).status).toBe(409);

    expect(events.some((event) => event.name === "invoice.paid" && (event.payload as SistemeleEvents["invoice.paid"]).invoiceId === invoice.id)).toBe(true);
    const detail = await json<ContactDetail>(await t.request(`/api/crm/contacts/${customer.id}`, { cookie: owner }));
    expect(detail.activities.map((activity) => activity.body)).toContain(`Invoice ${invoice.number} paid.`);

    // Deleting a payment (admin) makes the invoice unpaid again.
    expect((await t.request(`/api/invoices/${invoice.id}/payments/${full.payments[1].id}`, { method: "DELETE", cookie: member })).status).toBe(403);
    const reverted = await json<InvoiceDetail>(await t.request(`/api/invoices/${invoice.id}/payments/${full.payments[1].id}`, { method: "DELETE", cookie: owner }));
    expect(reverted).toMatchObject({ status: "issued", paidCents: 10_000, paidAt: null });
    expect(reverted.payments).toHaveLength(1);
  });

  it("refuses payments on drafts", async () => {
    const draft = await createDraft();
    const response = await t.request(`/api/invoices/${draft.id}/payments`, { method: "POST", cookie: owner, json: { amountCents: 100, paidOn: today } });
    expect(response.status).toBe(409);
    await t.request(`/api/invoices/${draft.id}`, { method: "DELETE", cookie: owner });
  });
});

describe("void", () => {
  it("needs an admin and a reason, keeps the number and emits invoice.voided", async () => {
    const invoice = await issued();
    expect((await t.request(`/api/invoices/${invoice.id}/void`, { method: "POST", cookie: member, json: { reason: "Wrong customer" } })).status).toBe(403);
    expect((await t.request(`/api/invoices/${invoice.id}/void`, { method: "POST", cookie: owner, json: { reason: "" } })).status).toBe(422);

    const voided = await json<InvoiceDetail>(await t.request(`/api/invoices/${invoice.id}/void`, { method: "POST", cookie: owner, json: { reason: "Wrong customer" } }));
    expect(voided).toMatchObject({ status: "void", number: invoice.number, voidReason: "Wrong customer", amountDueCents: 0 });
    expect(events.find((event) => event.name === "invoice.voided" && (event.payload as SistemeleEvents["invoice.voided"]).invoiceId === invoice.id)?.payload).toMatchObject({
      number: invoice.number,
      lines: [
        { productId: null, quantity: 2 },
        { productId: null, quantity: 1.5 },
      ],
    });
    expect((await t.request(`/api/invoices/${invoice.id}/void`, { method: "POST", cookie: owner, json: { reason: "Again" } })).status).toBe(409);
  });
});

describe("overdue", () => {
  it("filters overdue invoices and totals them in the metrics", async () => {
    const invoice = await issued();
    await t.db.prepare("UPDATE invoices SET due_date = ? WHERE id = ?").bind(addDays(today, -5), invoice.id).run();

    const list = await json<{ items: Invoice[]; total: number }>(await t.request("/api/invoices?status=overdue", { cookie: owner }));
    expect(list.items.map((item) => item.id)).toEqual([invoice.id]);
    expect(list.items[0]).toMatchObject({ overdue: true, daysOverdue: 5, status: "issued", amountDueCents: invoice.totalCents });

    const metrics = await json<{ items: Array<{ key: string; value: number; hint?: string }> }>(
      await t.request("/api/metrics?keys=invoices.overdue_amount,invoices.outstanding,invoices.revenue_30d", { cookie: owner }),
    );
    const byKey = Object.fromEntries(metrics.items.map((item) => [item.key, item]));
    expect(byKey["invoices.overdue_amount"]).toMatchObject({ value: invoice.totalCents, hint: "1 overdue" });
    const open = await json<{ items: Invoice[] }>(await t.request("/api/invoices?status=issued&limit=200", { cookie: owner }));
    expect(byKey["invoices.outstanding"].value).toBe(open.items.reduce((sum, item) => sum + item.amountDueCents, 0));
    expect(byKey["invoices.revenue_30d"].value).toBeGreaterThanOrEqual(invoice.totalCents);
  });

  it("searches by number and contact name", async () => {
    const found = await json<{ items: Array<{ module: string; title: string; href: string }> }>(await t.request(`/api/search?q=${encodeURIComponent(`INV-${year}-0001`)}`, { cookie: owner }));
    expect(found.items).toContainEqual(expect.objectContaining({ module: "invoices", title: `INV-${year}-0001` }));
    const list = await json<{ total: number }>(await t.request("/api/invoices?q=baltic", { cookie: owner }));
    expect(list.total).toBeGreaterThan(0);
  });
});

describe("from quote", () => {
  async function insertQuote(id: string, status: string) {
    await t.db.batch([
      t.db
        .prepare("INSERT INTO quotes (id, number, contact_id, status, issue_date, valid_until, currency, subtotal_cents, vat_cents, total_cents, notes) VALUES (?, ?, ?, ?, ?, ?, 'EUR', 15000, 3150, 18150, 'Quoted on site.')")
        .bind(id, `Q-${id}`, customer.id, status, today, addDays(today, 30)),
      t.db
        .prepare("INSERT INTO quote_lines (id, quote_id, position, description, quantity, unit, unit_price_cents, vat_rate_bps, discount_bps, subtotal_cents) VALUES (?, ?, 1, 'Gate', 1, 'pcs', 10000, 2100, 0, 10000)")
        .bind(`${id}_l1`, id),
      t.db
        .prepare("INSERT INTO quote_lines (id, quote_id, position, description, quantity, unit, unit_price_cents, vat_rate_bps, discount_bps, subtotal_cents) VALUES (?, ?, 2, 'Welding', 2, 'h', 2500, 2100, 0, 5000)")
        .bind(`${id}_l2`, id),
    ]);
  }

  it("turns an accepted quote into one draft invoice", async () => {
    await insertQuote("qt_accepted", "accepted");
    const response = await t.request("/api/invoices/from-quote/qt_accepted", { method: "POST", cookie: owner, json: {} });
    expect(response.status).toBe(201);
    const draft = await json<InvoiceDetail>(response);
    expect(draft).toMatchObject({ status: "draft", quoteId: "qt_accepted", quoteNumber: "Q-qt_accepted", contactId: customer.id, notes: "Quoted on site.", subtotalCents: 15_000, vatCents: 3_150, totalCents: 18_150 });
    expect(draft.lines.map(({ description, quantity, unit, unitPriceCents }) => ({ description, quantity, unit, unitPriceCents }))).toEqual([
      { description: "Gate", quantity: 1, unit: "pcs", unitPriceCents: 10_000 },
      { description: "Welding", quantity: 2, unit: "h", unitPriceCents: 2_500 },
    ]);

    const again = await t.request("/api/invoices/from-quote/qt_accepted", { method: "POST", cookie: owner, json: {} });
    expect(again.status).toBe(409);
    const body = await json<{ error: { code: string; message: string }; invoiceId: string }>(again);
    expect(body.invoiceId).toBe(draft.id);
    expect(body.error.code).toBe("conflict");

    // Once issued, the message names the number; after void the quote can be invoiced again.
    const { invoice } = await json<InvoiceActionResult>(await issue(draft.id));
    const named = await json<{ error: { message: string } }>(await t.request("/api/invoices/from-quote/qt_accepted", { method: "POST", cookie: owner, json: {} }));
    expect(named.error.message).toContain(invoice.number);
    await t.request(`/api/invoices/${draft.id}/void`, { method: "POST", cookie: owner, json: { reason: "Re-issue" } });
    expect((await t.request("/api/invoices/from-quote/qt_accepted", { method: "POST", cookie: owner, json: {} })).status).toBe(201);
  });

  it("refuses quotes that are not accepted or do not exist", async () => {
    await insertQuote("qt_sent", "sent");
    expect((await t.request("/api/invoices/from-quote/qt_sent", { method: "POST", cookie: owner, json: {} })).status).toBe(422);
    expect((await t.request("/api/invoices/from-quote/qt_missing", { method: "POST", cookie: owner, json: {} })).status).toBe(404);
  });
});

describe("sending and the public page", () => {
  it("emails a private link that shows the invoice with payment details", async () => {
    const invoice = await issued();
    const response = await t.request(`/api/invoices/${invoice.id}/send`, { method: "POST", cookie: owner, json: {} });
    expect(response.status).toBe(200);
    const { publicUrl, invoice: sent } = await json<InvoiceActionResult>(response);
    expect(sent.hasPublicLink).toBe(true);
    expect(publicUrl).toMatch(/^http:\/\/localhost\/i\/[A-Za-z0-9_-]{40,}$/u);

    const emails = await t.db.prepare("SELECT to_address, template, subject, related_id FROM email_log WHERE related_id = ?").bind(invoice.id).all();
    expect(emails.results).toEqual([{ to_address: "orders@balticbuild.test", template: "invoices.sent", subject: `Invoice ${invoice.number} from Northwind Workshop UAB`, related_id: invoice.id }]);

    const page = await t.request(new URL(publicUrl!).pathname);
    expect(page.status).toBe(200);
    expect(page.headers.get("x-robots-tag")).toContain("noindex");
    const html = await page.text();
    expect(html).toContain(`Invoice ${invoice.number}`);
    expect(html).toContain(IBAN);
    expect(html).toContain("Payment reference");
    expect(html).toContain("Use your browser&#x27;s print command to save a PDF.");
    expect(html).not.toContain("<script");

    // A new send replaces the link.
    const resent = await json<InvoiceActionResult>(await t.request(`/api/invoices/${invoice.id}/send`, { method: "POST", cookie: owner, json: {} }));
    expect((await t.request(new URL(publicUrl!).pathname)).status).toBe(404);
    expect((await t.request(new URL(resent.publicUrl!).pathname)).status).toBe(200);
  });

  it("issues and sends in one step, shows paid and void states, and 404s unknown links", async () => {
    const draft = await createDraft();
    const { invoice, publicUrl } = await json<InvoiceActionResult>(await issue(draft.id, { send: true }));
    expect(invoice.status).toBe("issued");
    const path = new URL(publicUrl!).pathname;

    await t.request(`/api/invoices/${invoice.id}/payments`, { method: "POST", cookie: owner, json: { amountCents: invoice.totalCents, paidOn: today } });
    const paidHtml = await (await t.request(path)).text();
    expect(paidHtml).toContain("Paid in full");
    expect(paidHtml).not.toContain("Payment reference");

    await t.request(`/api/invoices/${invoice.id}/void`, { method: "POST", cookie: owner, json: { reason: "Duplicate" } });
    const voidHtml = await (await t.request(path)).text();
    expect(voidHtml).toContain("This invoice was voided");
    expect(voidHtml).not.toContain("Duplicate");

    expect((await t.request("/i/not-a-real-token-but-long-enough-to-check")).status).toBe(404);
    expect((await t.request("/i/x")).status).toBe(404);
  });

  it("needs an issued invoice and a contact email", async () => {
    const draft = await createDraft();
    expect((await t.request(`/api/invoices/${draft.id}/send`, { method: "POST", cookie: owner, json: {} })).status).toBe(409);

    const other = await json<InvoiceDetail>(await t.request("/api/invoices", { method: "POST", cookie: owner, json: { contactId: noEmail.id, lines } }));
    expect((await issue(other.id, { send: true })).status).toBe(422);
    expect((await json<InvoiceDetail>(await t.request(`/api/invoices/${other.id}`, { cookie: owner }))).status).toBe("draft");
    await issue(other.id);
    expect((await t.request(`/api/invoices/${other.id}/send`, { method: "POST", cookie: owner, json: {} })).status).toBe(422);
  });
});

describe("MCP", () => {
  it("lists the invoice tools and runs them", async () => {
    const token = await t.createToken(owner, "member");
    const list = await json<{ result: { tools: Array<{ name: string }> } }>(await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method: "tools/list" } }));
    expect(list.result.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["invoices_list", "invoices_get", "invoices_create_draft", "invoices_create_from_quote", "invoices_issue", "invoices_send", "invoices_record_payment"]),
    );

    const call = (name: string, args: Record<string, unknown>) => t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } } });
    const created = await json<{ result: { structuredContent: InvoiceDetail } }>(await call("invoices_create_draft", { contactId: customer.id, lines }));
    expect(created.result.structuredContent).toMatchObject({ status: "draft", totalCents: 30_734 });
    const listed = await json<{ result: { structuredContent: { total: number } } }>(await call("invoices_list", { status: "draft" }));
    expect(listed.result.structuredContent.total).toBeGreaterThan(0);
  });
});

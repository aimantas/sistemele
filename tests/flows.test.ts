import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, json, type TestApp } from "./helpers";

/**
 * End-to-end business flow across modules, through the public API only:
 * website request → lead → contact + deal → quote → customer accepts → deal won →
 * invoice from quote → issue (stock deducted) → paid (timeline) → void (stock back).
 */
let t: TestApp;
let owner: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
  await t.request("/api/settings/business", { method: "PUT", cookie: owner, json: { name: "Flow Co", email: "sales@flow.test", iban: "LT00 0000 0000 0000 0001" } });
});
afterAll(() => t.dispose());

describe("lead to cash", () => {
  it("runs the whole flow and keeps every module consistent", async () => {
    // Website request → lead → qualified → converted into a contact and a deal
    const inquiry = await json<{ ok: boolean; reference?: string }>(await t.request("/api/public/crm/inquiries", { method: "POST", json: { name: "Rasa", email: "rasa@buyer.test", company: "Buyer UAB", message: "10 brackets please" } }));
    expect(inquiry).toEqual({ ok: true });
    const leadId = (await t.db.prepare("SELECT id FROM leads WHERE email = 'rasa@buyer.test'").first<{ id: string }>())!.id;
    await t.request(`/api/crm/leads/${leadId}`, { method: "PATCH", cookie: owner, json: { status: "qualified" } });
    const converted = await json<{ contact: { id: string }; deal: { id: string; stage: string } }>(await t.request(`/api/crm/leads/${leadId}/convert`, { method: "POST", cookie: owner, json: { dealTitle: "Brackets" } }));
    const contactId = converted.contact.id;
    const dealId = converted.deal.id;
    expect(converted.deal.stage).toBe("qualified");

    // Product with stock
    const product = await json<{ id: string }>(
      await t.request("/api/catalog/products", { method: "POST", cookie: owner, json: { sku: "BR-10", name: "Steel bracket", unit: "pcs", priceCents: 1250, costCents: 600, vatRateBps: 2100, trackStock: true, reorderPoint: 2 } }),
    );
    await t.request(`/api/catalog/products/${product.id}/movements`, { method: "POST", cookie: owner, json: { reason: "receipt", quantity: 25, note: "Opening stock" } });

    // Quote, sent, accepted by the customer through the private link
    const quote = await json<{ id: string; totalCents: number }>(
      await t.request("/api/quotes", {
        method: "POST",
        cookie: owner,
        json: { contactId, dealId, lines: [{ productId: product.id, description: "Steel bracket", quantity: 10, unit: "pcs", unitPriceCents: 1250, vatRateBps: 2100 }] },
      }),
    );
    expect(quote.totalCents).toBe(15125);
    const sent = await json<{ publicUrl: string }>(await t.request(`/api/quotes/${quote.id}/send`, { method: "POST", cookie: owner, json: {} }));
    const token = new URL(sent.publicUrl).pathname.split("/").pop();
    expect((await t.request(`/api/public/quotes/${token}/accept`, { method: "POST", json: {} })).status).toBeLessThan(400);
    await t.settle();

    const wonDeal = await json<{ stage: string }>(await t.request(`/api/crm/deals/${dealId}`, { cookie: owner }));
    expect(wonDeal.stage).toBe("won");

    // Invoice from the accepted quote, issued → stock deducted
    const invoice = await json<{ id: string }>(await t.request(`/api/invoices/from-quote/${quote.id}`, { method: "POST", cookie: owner, json: {} }));
    const issued = await t.request(`/api/invoices/${invoice.id}/issue`, { method: "POST", cookie: owner, json: {} });
    expect(issued.status).toBe(200);
    const afterIssue = await json<{ product: { stockOnHand: number } }>(await t.request(`/api/catalog/products/${product.id}`, { cookie: owner }));
    expect(afterIssue.product.stockOnHand).toBe(15);

    // Paid in full → status paid, timeline entry in CRM
    const detail = await json<{ totalCents?: number; invoice?: { totalCents: number } }>(await t.request(`/api/invoices/${invoice.id}`, { cookie: owner }));
    const total = detail.invoice?.totalCents ?? detail.totalCents ?? 0;
    expect(total).toBe(15125);
    const paid = await t.request(`/api/invoices/${invoice.id}/payments`, { method: "POST", cookie: owner, json: { amountCents: total, paidOn: "2026-11-18", method: "bank_transfer", reference: "test" } });
    expect(paid.status).toBeLessThan(400);
    const timeline = await json<{ activities: Array<{ body: string }> }>(await t.request(`/api/crm/contacts/${contactId}`, { cookie: owner }));
    const bodies = timeline.activities.map((a) => a.body).join("\n");
    expect(bodies).toMatch(/Quote .* sent/u);
    expect(bodies).toMatch(/Quote .* accepted/u);
    expect(bodies).toMatch(/Invoice .* issued/u);
    expect(bodies).toMatch(/Invoice .* paid/u);

    // Metrics reflect the money
    const metrics = await json<{ items: Array<{ key: string; value: number }> }>(await t.request("/api/metrics", { cookie: owner }));
    const value = (key: string) => metrics.items.find((m) => m.key === key)?.value;
    expect(value("invoices.revenue_30d")).toBe(15125);
    expect(value("invoices.outstanding")).toBe(0);

    // Voiding returns the stock
    expect((await t.request(`/api/invoices/${invoice.id}/void`, { method: "POST", cookie: owner, json: { reason: "Customer returned the goods" } })).status).toBe(200);
    const afterVoid = await json<{ product: { stockOnHand: number } }>(await t.request(`/api/catalog/products/${product.id}`, { cookie: owner }));
    expect(afterVoid.product.stockOnHand).toBe(25);

    // Every core MCP + module tool is listed
    const token2 = await t.createToken(owner, "owner");
    const tools = await json<{ result: { tools: Array<{ name: string }> } }>(await t.request("/mcp", { method: "POST", token: token2, json: { jsonrpc: "2.0", id: 1, method: "tools/list" } }));
    const names = tools.result.tools.map((tool) => tool.name);
    for (const prefix of ["core_", "crm_", "catalog_", "quotes_", "invoices_"]) expect(names.some((name) => name.startsWith(prefix))).toBe(true);
  });
});

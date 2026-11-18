import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { catalogModule } from "@/modules/catalog/server";
import { recordMovement } from "@/modules/catalog/server/service";
import { slugify, type Movement, type MovementResult, type Product, type ProductDetail } from "@/modules/catalog/shared/schema";
import type { SistemeleEvents } from "@/modules/events";
import { serverModules } from "@/modules/server";
import type { ServerModule } from "@/modules/types.server";
import type { MetricValue, SearchResult } from "@/shared/api";
import type { SessionUser } from "@/shared/auth";
import type { ProductSummary } from "@/shared/lines";
import { createModuleContext } from "@/worker/context";
import { addUser, createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
});
afterAll(() => t.dispose());

type ErrorBody = { error: { code: string; message: string; issues?: Record<string, string> } };

const create = (body: Record<string, unknown>, cookie = owner) => t.request("/api/catalog/products", { method: "POST", cookie, json: body });
async function createProduct(body: Record<string, unknown>): Promise<Product> {
  const response = await create(body);
  expect(response.status).toBe(201);
  return json<Product>(response);
}
const move = (id: string, body: Record<string, unknown>, cookie = owner) => t.request(`/api/catalog/products/${id}/movements`, { method: "POST", cookie, json: body });
async function moveOk(id: string, body: Record<string, unknown>): Promise<MovementResult> {
  const response = await move(id, body);
  expect(response.status).toBe(201);
  return json<MovementResult>(response);
}
async function ledgerSum(productId: string): Promise<number> {
  const row = await t.db.prepare("SELECT ROUND(COALESCE(SUM(quantity), 0), 3) AS total FROM stock_movements WHERE product_id = ?").bind(productId).first<{ total: number }>();
  return row?.total ?? 0;
}
async function cachedStock(productId: string): Promise<number> {
  return (await t.db.prepare("SELECT stock_on_hand AS stock FROM products WHERE id = ?").bind(productId).first<{ stock: number }>())?.stock ?? NaN;
}
async function ownerUser(): Promise<SessionUser> {
  const row = await t.db.prepare("SELECT id, email, name, role FROM users WHERE email = 'owner@example.com'").first<Omit<SessionUser, "via">>();
  if (!row) throw new Error("owner missing");
  return { ...row, via: "session" };
}
async function metrics(): Promise<Record<string, MetricValue>> {
  const body = await json<{ items: MetricValue[] }>(await t.request("/api/metrics?keys=catalog.low_stock_count,catalog.stock_value", { cookie: owner }));
  return Object.fromEntries(body.items.map((item) => [item.key, item]));
}

describe("products", () => {
  it("creates, reads, updates, archives and restores a product", async () => {
    const created = await createProduct({ sku: "GATE-1", name: "Garden gate", priceCents: 20000, costCents: 12000, isPublic: true });
    expect(created).toMatchObject({ sku: "GATE-1", slug: "garden-gate", kind: "product", unit: "pcs", vatRateBps: 2100, trackStock: true, stockOnHand: 0, isPublic: true, status: "active", description: "" });

    const detail = await json<ProductDetail>(await t.request(`/api/catalog/products/${created.id}`, { cookie: owner }));
    expect(detail.product.id).toBe(created.id);
    expect(detail.movements).toEqual([]);

    const patched = await json<Product>(await t.request(`/api/catalog/products/${created.id}`, { method: "PATCH", cookie: owner, json: { name: "Garden gate 1 m", reorderPoint: 2 } }));
    // Fields not sent keep their values; the slug stays so public links survive a rename.
    expect(patched).toMatchObject({ name: "Garden gate 1 m", reorderPoint: 2, slug: "garden-gate", priceCents: 20000, costCents: 12000, isPublic: true });

    const archived = await json<Product>(await t.request(`/api/catalog/products/${created.id}/archive`, { method: "POST", cookie: owner, json: {} }));
    expect(archived.status).toBe("archived");
    const active = await json<{ items: Product[] }>(await t.request("/api/catalog/products?q=GATE-1", { cookie: owner }));
    expect(active.items.map((p) => p.id)).not.toContain(created.id);
    const archivedList = await json<{ items: Product[] }>(await t.request("/api/catalog/products?q=GATE-1&status=archived", { cookie: owner }));
    expect(archivedList.items.map((p) => p.id)).toContain(created.id);

    const restored = await json<Product>(await t.request(`/api/catalog/products/${created.id}/restore`, { method: "POST", cookie: owner, json: {} }));
    expect(restored.status).toBe("active");

    const audit = await t.db.prepare("SELECT action FROM audit_log WHERE entity_id = ? ORDER BY created_at").bind(created.id).all<{ action: string }>();
    expect(audit.results.map((row) => row.action)).toEqual(["product.created", "product.updated", "product.archived", "product.restored"]);
  });

  it("defaults services to untracked stock and filters by kind", async () => {
    const service = await createProduct({ sku: "SRV-WELD-1", name: "Welding work", kind: "service", unit: "h", priceCents: 4500 });
    expect(service).toMatchObject({ kind: "service", trackStock: false, unit: "h" });
    const services = await json<{ items: Product[] }>(await t.request("/api/catalog/products?kind=service", { cookie: owner }));
    expect(services.items.every((p) => p.kind === "service")).toBe(true);
    expect(services.items.map((p) => p.id)).toContain(service.id);
  });

  it("rejects a duplicate SKU with 409, ignoring case", async () => {
    const first = await createProduct({ sku: "DUP-1", name: "First" });
    const duplicate = await create({ sku: "dup-1", name: "Second" });
    expect(duplicate.status).toBe(409);
    const body = await json<ErrorBody>(duplicate);
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toContain("already used by First");

    const other = await createProduct({ sku: "DUP-2", name: "Other" });
    const renamed = await t.request(`/api/catalog/products/${other.id}`, { method: "PATCH", cookie: owner, json: { sku: "DUP-1" } });
    expect(renamed.status).toBe(409);
    // Changing only the case of its own SKU is fine.
    const own = await t.request(`/api/catalog/products/${first.id}`, { method: "PATCH", cookie: owner, json: { sku: "dup-1" } });
    expect(own.status).toBe(200);
  });

  it("validates input with field messages", async () => {
    const response = await create({ sku: "", name: "", priceCents: -1, vatRateBps: 20000, imageUrl: "javascript:alert(1)" });
    expect(response.status).toBe(422);
    const body = await json<ErrorBody>(response);
    expect(Object.keys(body.error.issues ?? {})).toEqual(expect.arrayContaining(["sku", "name", "priceCents", "vatRateBps", "imageUrl"]));
  });

  it("generates unique ASCII slugs from names, including Lithuanian letters", async () => {
    expect(slugify("Ąžuolinė čiužinių šėrykla, ĮŪ")).toBe("azuoline-ciuziniu-serykla-iu");
    expect(slugify("Straße & Øresund — 2×1 m")).toBe("strasse-oresund-2-1-m");
    expect(slugify("***")).toBe("product");

    const a = await createProduct({ sku: "TV-1", name: "Plieninė tvora" });
    const b = await createProduct({ sku: "TV-2", name: "Plieninė  tvora!" });
    const c = await createProduct({ sku: "TV-3", name: "PLIENINĖ TVORA" });
    expect([a.slug, b.slug, c.slug]).toEqual(["plienine-tvora", "plienine-tvora-2", "plienine-tvora-3"]);
  });

  it("searches name and SKU and returns what the line editor needs", async () => {
    await createProduct({ sku: "MESH-77", name: "Mesh panel", priceCents: 3800, vatRateBps: 900 });
    const response = await json<{ items: ProductSummary[]; total: number }>(await t.request("/api/catalog/products?q=mesh-77&limit=6", { cookie: owner }));
    expect(response.total).toBe(1);
    const item = response.items[0];
    const summary: ProductSummary = { id: item.id, sku: "MESH-77", name: "Mesh panel", unit: "pcs", priceCents: 3800, vatRateBps: 900, kind: "product", trackStock: true, stockOnHand: 0 };
    expect(item).toMatchObject(summary);
    expect(typeof item.trackStock).toBe("boolean");

    await createProduct({ sku: "BOLT-100", name: "100% steel bolt" });
    const literal = await json<{ items: Product[] }>(await t.request(`/api/catalog/products?q=${encodeURIComponent("%")}`, { cookie: owner }));
    expect(literal.items.map((p) => p.name)).toEqual(["100% steel bolt"]);
  });

  it("lets members manage products and stock", async () => {
    await addUser(t, "member@example.com", "member");
    const member = await t.signIn("member@example.com");
    const created = await create({ sku: "MEM-1", name: "Member product" }, member);
    expect(created.status).toBe(201);
    const product = await json<Product>(created);
    expect((await move(product.id, { reason: "receipt", quantity: 3 }, member)).status).toBe(201);
    expect((await t.request(`/api/catalog/products/${product.id}/archive`, { method: "POST", cookie: member, json: {} })).status).toBe(200);
  });
});

describe("stock", () => {
  it("records receipts, adjustments and returns and keeps the cache equal to the ledger", async () => {
    const product = await createProduct({ sku: "STK-1", name: "Square tube", costCents: 1500 });

    const received = await moveOk(product.id, { reason: "receipt", quantity: 10, note: "Delivery 1182" });
    expect(received.product.stockOnHand).toBe(10);
    expect(received.movement).toMatchObject({ quantity: 10, reason: "receipt", note: "Delivery 1182", productSku: "STK-1" });
    expect(received.movement?.createdByName).toBeTruthy();
    expect(await ledgerSum(product.id)).toBe(await cachedStock(product.id));

    const adjusted = await moveOk(product.id, { reason: "adjustment", quantity: -2.5, note: "Damaged" });
    expect(adjusted.product.stockOnHand).toBe(7.5);
    const returned = await moveOk(product.id, { reason: "return", quantity: 1 });
    expect(returned.product.stockOnHand).toBe(8.5);
    expect(await ledgerSum(product.id)).toBe(8.5);
    expect(await cachedStock(product.id)).toBe(8.5);

    const detail = await json<ProductDetail>(await t.request(`/api/catalog/products/${product.id}`, { cookie: owner }));
    expect(detail.movements.map((m) => [m.reason, m.quantity, m.balanceAfter])).toEqual([
      ["return", 1, 8.5],
      ["adjustment", -2.5, 7.5],
      ["receipt", 10, 10],
    ]);

    const ledger = await json<{ items: Movement[] }>(await t.request(`/api/catalog/movements?productId=${product.id}&limit=2`, { cookie: owner }));
    expect(ledger.items.map((m) => m.reason)).toEqual(["return", "adjustment"]);
    expect(ledger.items[0]).toMatchObject({ productName: "Square tube", unit: "pcs" });
  });

  it("records the difference for a count, and nothing when the count matches", async () => {
    const product = await createProduct({ sku: "CNT-1", name: "Counted part" });
    await moveOk(product.id, { reason: "receipt", quantity: 8.5 });

    const counted = await moveOk(product.id, { reason: "count", countedQuantity: 6, note: "Stock-take" });
    expect(counted.movement).toMatchObject({ reason: "count", quantity: -2.5 });
    expect(counted.product.stockOnHand).toBe(6);

    const same = await moveOk(product.id, { reason: "count", countedQuantity: 6 });
    expect(same.movement).toBeNull();
    expect(same.product.stockOnHand).toBe(6);
    const rows = await t.db.prepare("SELECT COUNT(*) AS n FROM stock_movements WHERE product_id = ?").bind(product.id).first<{ n: number }>();
    expect(rows?.n).toBe(2);
    expect(await ledgerSum(product.id)).toBe(await cachedStock(product.id));
  });

  it("rejects negative receipts, zero adjustments and untracked products", async () => {
    const product = await createProduct({ sku: "REJ-1", name: "Strict part" });
    const negative = await move(product.id, { reason: "receipt", quantity: -3 });
    expect(negative.status).toBe(422);
    expect((await json<ErrorBody>(negative)).error.issues).toHaveProperty("quantity");
    expect((await move(product.id, { reason: "return", quantity: 0 })).status).toBe(422);
    expect((await move(product.id, { reason: "adjustment", quantity: 0 })).status).toBe(422);
    expect((await move(product.id, { reason: "sale", quantity: -1 })).status).toBe(422);
    expect((await move(product.id, { reason: "count", countedQuantity: -1 })).status).toBe(422);
    expect(await cachedStock(product.id)).toBe(0);

    const service = await createProduct({ sku: "REJ-SRV", name: "Untracked service", kind: "service" });
    const untracked = await move(service.id, { reason: "receipt", quantity: 1 });
    expect(untracked.status).toBe(400);
    expect((await json<ErrorBody>(untracked)).error.message).toContain("not tracked");

    expect((await move("prd_missing", { reason: "receipt", quantity: 1 })).status).toBe(404);
  });

  it("flags low stock in the list, the metrics and a stock.low event", async () => {
    const before = await metrics();
    const product = await createProduct({ sku: "LOW-1", name: "Low part", reorderPoint: 5, costCents: 300 });
    await moveOk(product.id, { reason: "receipt", quantity: 10 });

    const afterReceipt = await metrics();
    expect(afterReceipt["catalog.stock_value"].value - before["catalog.stock_value"].value).toBe(3000);
    expect(afterReceipt["catalog.stock_value"].format).toBe("money");
    expect(afterReceipt["catalog.stock_value"].hint).toMatch(/^at cost/u);
    expect(afterReceipt["catalog.low_stock_count"].value).toBe(before["catalog.low_stock_count"].value);

    // A spy module listens for stock.low through the real event bus.
    const events: Array<SistemeleEvents["stock.low"]> = [];
    const spy: ServerModule = { id: "spy", name: "Spy", description: "Test listener", events: { "stock.low": async (payload) => void events.push(payload) } };
    const ctx = createModuleContext({ env: t.env, user: await ownerUser(), modules: [catalogModule, spy] });
    await recordMovement(ctx, product.id, { reason: "adjustment", quantity: -6, note: "Used in workshop" });
    await recordMovement(ctx, product.id, { reason: "adjustment", quantity: -1 });
    expect(events).toEqual([{ productId: product.id, sku: "LOW-1", onHand: 4, reorderPoint: 5 }]);

    const low = await json<{ items: Product[] }>(await t.request("/api/catalog/products?lowStock=1", { cookie: owner }));
    expect(low.items.map((p) => p.id)).toContain(product.id);
    expect(low.items.every((p) => p.trackStock && p.stockOnHand <= p.reorderPoint)).toBe(true);

    const afterLow = await metrics();
    expect(afterLow["catalog.low_stock_count"].value).toBe(before["catalog.low_stock_count"].value + 1);
    expect(afterLow["catalog.low_stock_count"].hint).toMatch(/out of stock$/u);
  });
});

describe("invoice events", () => {
  it("deducts stock once per issued invoice and puts it back when the invoice is voided", async () => {
    const contact = await json<{ id: string }>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Stock Buyer UAB" } }));
    const a = await createProduct({ sku: "INV-A", name: "Invoiced A", reorderPoint: 16 });
    const b = await createProduct({ sku: "INV-B", name: "Invoiced B" });
    const service = await createProduct({ sku: "INV-S", name: "Invoiced service", kind: "service" });
    await moveOk(a.id, { reason: "receipt", quantity: 20 });
    await moveOk(b.id, { reason: "receipt", quantity: 5 });

    const ctx = createModuleContext({ env: t.env, user: await ownerUser(), modules: serverModules });
    const lines = [
      { productId: a.id, quantity: 3 },
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1.5 },
      { productId: service.id, quantity: 1 },
      { productId: "prd_missing", quantity: 1 },
      { productId: null, quantity: 4 },
    ];
    const issued = { invoiceId: "inv_test_1", contactId: contact.id, number: "INV-0001", totalCents: 10000, lines };
    await ctx.emit("invoice.issued", issued);
    expect(await cachedStock(a.id)).toBe(15);
    expect(await cachedStock(b.id)).toBe(3.5);
    expect(await cachedStock(service.id)).toBe(0);

    // A repeated event changes nothing.
    await ctx.emit("invoice.issued", issued);
    expect(await cachedStock(a.id)).toBe(15);
    const sales = await t.db.prepare("SELECT product_id, quantity, reference_type, reference_id FROM stock_movements WHERE reason = 'sale' AND reference_id = 'inv_test_1' ORDER BY quantity").all();
    expect(sales.results).toEqual([
      { product_id: a.id, quantity: -5, reference_type: "invoice", reference_id: "inv_test_1" },
      { product_id: b.id, quantity: -1.5, reference_type: "invoice", reference_id: "inv_test_1" },
    ]);

    const voided = { invoiceId: "inv_test_1", contactId: contact.id, number: "INV-0001", lines };
    await ctx.emit("invoice.voided", voided);
    await ctx.emit("invoice.voided", voided);
    expect(await cachedStock(a.id)).toBe(20);
    expect(await cachedStock(b.id)).toBe(5);
    const returns = await t.db.prepare("SELECT product_id, quantity FROM stock_movements WHERE reference_type = 'invoice_void' AND reference_id = 'inv_test_1' AND reason = 'return' ORDER BY quantity DESC").all();
    expect(returns.results).toEqual([
      { product_id: a.id, quantity: 5 },
      { product_id: b.id, quantity: 1.5 },
    ]);
    for (const id of [a.id, b.id]) expect(await ledgerSum(id)).toBe(await cachedStock(id));

    const failures = await t.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'event.failed' AND summary LIKE 'catalog %'").first<{ n: number }>();
    expect(failures?.n).toBe(0);
  });
});

describe("search and MCP", () => {
  it("finds products in global search", async () => {
    const product = await createProduct({ sku: "SRCH-9", name: "Searchable bracket", priceCents: 450 });
    const results = await json<{ items: SearchResult[] }>(await t.request("/api/search?q=searchable", { cookie: owner }));
    expect(results.items).toContainEqual(expect.objectContaining({ module: "catalog", id: product.id, href: `/app/catalog/products/${product.id}` }));
  });

  it("exposes catalog tools over MCP", async () => {
    const token = await t.createToken(owner);
    const list = await json<{ result: { tools: Array<{ name: string }> } }>(await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method: "tools/list" } }));
    expect(list.result.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["catalog_list_products", "catalog_get_product", "catalog_create_product", "catalog_update_product", "catalog_adjust_stock", "catalog_list_low_stock"]),
    );

    const call = (name: string, args: Record<string, unknown>) => t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } } });
    const created = await json<{ result: { structuredContent: Product } }>(await call("catalog_create_product", { sku: "MCP-1", name: "Agent part", priceCents: 1000 }));
    expect(created.result.structuredContent).toMatchObject({ sku: "MCP-1", trackStock: true });
    const adjusted = await json<{ result: { structuredContent: MovementResult } }>(await call("catalog_adjust_stock", { productId: "mcp-1", reason: "receipt", quantity: 4 }));
    expect(adjusted.result.structuredContent.product.stockOnHand).toBe(4);
    const counted = await json<{ result: { structuredContent: MovementResult } }>(await call("catalog_adjust_stock", { productId: "MCP-1", reason: "count", countedQuantity: 3 }));
    expect(counted.result.structuredContent.movement?.quantity).toBe(-1);
    const fetched = await json<{ result: { structuredContent: ProductDetail } }>(await call("catalog_get_product", { productId: "MCP-1" }));
    expect(fetched.result.structuredContent.movements).toHaveLength(2);
    const low = await json<{ result: { structuredContent: { items: Product[] } } }>(await call("catalog_list_low_stock", {}));
    expect(Array.isArray(low.result.structuredContent.items)).toBe(true);
  });
});

describe("public site", () => {
  let gate: Product;
  let quoteOnly: Product;
  let service: Product;
  let hidden: Product;
  let archived: Product;

  beforeAll(async () => {
    gate = await createProduct({ sku: "PUB-GATE", name: "Public gate", description: "Hot-dip galvanised gate.\n\nWith hinges and a latch.", priceCents: 10000, vatRateBps: 2100, isPublic: true });
    quoteOnly = await createProduct({ sku: "PUB-CUSTOM", name: "Custom work", kind: "service", isPublic: true });
    service = await createProduct({ sku: "PUB-WELD", name: "Public welding", kind: "service", unit: "h", priceCents: 4500, isPublic: true });
    hidden = await createProduct({ sku: "PUB-HIDDEN", name: "Hidden bracket", priceCents: 100 });
    archived = await createProduct({ sku: "PUB-OLD", name: "Old fence", priceCents: 100, isPublic: true });
    await t.request(`/api/catalog/products/${archived.id}/archive`, { method: "POST", cookie: owner, json: {} });
  });

  it("lists public active products with VAT-inclusive prices", async () => {
    const response = await t.request("/products");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<h1>Products</h1>");
    expect(html).toContain('<link rel="canonical" href="http://localhost/products"/>');
    expect(html).toContain(`href="/products/${gate.slug}"`);
    expect(html).toContain("€121.00");
    expect(html).toContain("€100.00 excl. VAT");
    expect(html).toContain("Out of stock");
    expect(html).toContain("Price on request");
    expect(html).not.toContain("Hidden bracket");
    expect(html).not.toContain("Old fence");

    const home = await (await t.request("/")).text();
    expect(home).toContain('href="/products"');
  });

  it("renders a product page with Product JSON-LD only when it has a price", async () => {
    const page = await t.request(`/products/${gate.slug}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("<h1>Public gate</h1>");
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"Offer"');
    expect(html).toContain('"price":"121.00"');
    expect(html).toContain('"availability":"https://schema.org/OutOfStock"');

    const unpriced = await (await t.request(`/products/${quoteOnly.slug}`)).text();
    expect(unpriced).toContain("Price on request");
    expect(unpriced).toContain('"@type":"BreadcrumbList"');
    expect(unpriced).not.toContain('"@type":"Product"');
    expect(unpriced).not.toContain('"@type":"Offer"');

    // Untracked services have an offer but no availability claim.
    const serviceHtml = await (await t.request(`/products/${service.slug}`)).text();
    expect(serviceHtml).toContain('"@type":"Service"');
    expect(serviceHtml).not.toContain("schema.org/InStock");
    expect(serviceHtml).not.toContain("Out of stock");

    const markdown = await t.request(`/products/${gate.slug}`, { headers: { accept: "text/markdown" } });
    expect(markdown.headers.get("content-type")).toContain("text/markdown");
    const text = await markdown.text();
    expect(text).toContain("# Public gate");
    expect(text).toContain("€121.00 per pcs incl. VAT");

    for (const slug of [hidden.slug, archived.slug, "no-such-product"]) expect((await t.request(`/products/${slug}`)).status).toBe(404);
  });

  it("shows in stock after a receipt", async () => {
    await moveOk(gate.id, { reason: "receipt", quantity: 2 });
    const html = await (await t.request(`/products/${gate.slug}`)).text();
    expect(html).toContain('"availability":"https://schema.org/InStock"');
    expect(html).toContain("In stock");
  });

  it("adds public product URLs to the sitemap", async () => {
    const xml = await (await t.request("/sitemap.xml")).text();
    expect(xml).toMatch(new RegExp(`<loc>http://localhost/products/${gate.slug}</loc><lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`, "u"));
    expect(xml).toContain("<loc>http://localhost/products</loc>");
    expect(xml).not.toContain(`/products/${hidden.slug}<`);
    expect(xml).not.toContain(`/products/${archived.slug}<`);
  });
});

describe("demo seed", () => {
  it("keeps every product's stock equal to its ledger and flags two low-stock items", async () => {
    const app = await createTestApp();
    try {
      const sql = readFileSync(join(process.cwd(), "seed", "03_catalog.sql"), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .split(/;\s*(?:\n|$)/u)
        .map((statement) => statement.trim())
        .filter(Boolean);
      await app.db.batch(sql.map((statement) => app.db.prepare(statement)));
      const mismatched = await app.db
        .prepare("SELECT p.id FROM products p WHERE p.stock_on_hand <> (SELECT COALESCE(SUM(quantity), 0) FROM stock_movements m WHERE m.product_id = p.id)")
        .all();
      expect(mismatched.results).toEqual([]);
      const low = await app.db.prepare("SELECT COUNT(*) AS n FROM products WHERE status = 'active' AND track_stock = 1 AND stock_on_hand <= reorder_point").first<{ n: number }>();
      expect(low?.n).toBe(2);
    } finally {
      await app.dispose();
    }
  });
});

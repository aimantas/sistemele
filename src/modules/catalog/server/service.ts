import type { Page, SearchResult } from "@/shared/api";
import { newId } from "@/shared/ids";
import { formatMoney } from "@/shared/money";
import type { StockLine } from "@/modules/events";
import type { ModuleContext } from "@/modules/types.server";
import { likePattern, placeholders, type SqlValue } from "@/worker/lib/db";
import { badRequest, conflict, notFound } from "@/worker/lib/errors";
import {
  MOVEMENT_REASON_LABELS,
  movementInputSchema,
  productInputSchema,
  productPatchSchema,
  roundQuantity,
  slugify,
  type Movement,
  type MovementInput,
  type MovementResult,
  type Product,
  type ProductDetail,
  type ProductInput,
  type ProductKind,
  type ProductPatch,
  type ProductStatus,
} from "../shared/schema";

/**
 * Catalog services. Routes, MCP tools, event handlers, the public site and
 * tests call these. Functions validate their input, so callers may pass raw JSON.
 *
 * Stock rule: `stock_movements` is the ledger; `products.stock_on_hand` is a
 * cache recomputed from the ledger in the same batch that writes a movement.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const PRODUCT_COLUMNS = `id, sku, slug, name, description, kind, unit, price_cents AS priceCents, cost_cents AS costCents, vat_rate_bps AS vatRateBps,
  track_stock AS trackStock, stock_on_hand AS stockOnHand, reorder_point AS reorderPoint, is_public AS isPublic, image_url AS imageUrl, status,
  created_at AS createdAt, updated_at AS updatedAt`;

const MOVEMENT_COLUMNS = `m.id, m.product_id AS productId, p.name AS productName, p.sku AS productSku, p.unit, m.quantity, m.reason,
  m.reference_type AS referenceType, m.reference_id AS referenceId, m.note, COALESCE(NULLIF(u.name, ''), u.email) AS createdByName, m.created_at AS createdAt`;

const MOVEMENT_JOINS = "stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.created_by";

/** At or below the reorder point (includes out of stock). */
const LOW_STOCK_SQL = "track_stock = 1 AND stock_on_hand <= reorder_point";

type ProductRow = Omit<Product, "trackStock" | "isPublic"> & { trackStock: number; isPublic: number };
const toProduct = (row: ProductRow): Product => ({ ...row, trackStock: row.trackStock === 1, isPublic: row.isPublic === 1 });

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

/** Recomputes the cached stock from the ledger. Always batch it with the ledger write. */
function refreshStockStatement(ctx: ModuleContext, productId: string): D1PreparedStatement {
  return ctx.db.prepare(
    `UPDATE products SET stock_on_hand = (SELECT ROUND(COALESCE(SUM(quantity), 0), 3) FROM stock_movements WHERE product_id = ?), updated_at = ${NOW} WHERE id = ?`,
    [productId, productId],
  );
}

// Products

export interface ProductListOptions {
  q?: string;
  status?: ProductStatus;
  kind?: ProductKind;
  lowStock?: boolean;
  limit?: number;
  offset?: number;
}

export async function listProducts(ctx: ModuleContext, options: ProductListOptions = {}): Promise<Page<Product>> {
  ctx.requireRole("member");
  const where: string[] = ["status = ?"];
  const params: SqlValue[] = [options.status ?? "active"];
  if (options.q?.trim()) {
    const pattern = likePattern(options.q.trim());
    where.push("(name LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  if (options.kind) {
    where.push("kind = ?");
    params.push(options.kind);
  }
  if (options.lowStock) where.push(LOW_STOCK_SQL);
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const order = options.lowStock ? "stock_on_hand - reorder_point ASC, name COLLATE NOCASE" : "name COLLATE NOCASE, sku";
  const [rows, total] = await Promise.all([
    ctx.db.all<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    ctx.db.value<number>(`SELECT COUNT(*) FROM products ${whereSql}`, params),
  ]);
  return { items: rows.map(toProduct), total: total ?? 0 };
}

async function findProduct(ctx: ModuleContext, id: string): Promise<Product | null> {
  const row = await ctx.db.first<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [id]);
  return row ? toProduct(row) : null;
}

export async function getProduct(ctx: ModuleContext, id: string): Promise<Product> {
  ctx.requireRole("member");
  const product = await findProduct(ctx, id);
  if (!product) throw notFound("Product");
  return product;
}

/** Accepts a product id (prd_…) or a SKU (case-insensitive). Used by MCP tools. */
export async function getProductByIdOrSku(ctx: ModuleContext, idOrSku: string): Promise<Product> {
  ctx.requireRole("member");
  const row = await ctx.db.first<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? OR sku = ? LIMIT 1`, [idOrSku, idOrSku.trim()]);
  if (!row) throw notFound("Product");
  return toProduct(row);
}

export async function getProductDetail(ctx: ModuleContext, id: string): Promise<ProductDetail> {
  const product = await getProduct(ctx, id);
  const movements = await ctx.db.all<Movement>(
    `SELECT * FROM (
       SELECT ${MOVEMENT_COLUMNS}, ROUND(SUM(m.quantity) OVER (ORDER BY m.created_at, m.id ROWS UNBOUNDED PRECEDING), 3) AS balanceAfter
       FROM ${MOVEMENT_JOINS} WHERE m.product_id = ?
     ) ORDER BY createdAt DESC, id DESC LIMIT 50`,
    [id],
  );
  return { product, movements };
}

async function assertSkuFree(ctx: ModuleContext, sku: string, exceptId?: string): Promise<void> {
  const existing = await ctx.db.first<{ id: string; name: string; status: string }>("SELECT id, name, status FROM products WHERE sku = ? AND id <> ?", [sku, exceptId ?? ""]);
  if (existing) throw conflict(`SKU ${sku} is already used by ${existing.name}${existing.status === "archived" ? " (archived)" : ""}. Choose another SKU.`);
}

const isUniqueError = (error: unknown, column: string) => error instanceof Error && error.message.includes("UNIQUE") && error.message.includes(`products.${column}`);

/** "steel-gate", then "steel-gate-2", "steel-gate-3" … */
async function uniqueSlug(ctx: ModuleContext, base: string): Promise<string> {
  const rows = await ctx.db.all<{ slug: string }>("SELECT slug FROM products WHERE slug = ? OR slug LIKE ?", [base, `${base}-%`]);
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createProduct(ctx: ModuleContext, raw: ProductInput): Promise<Product> {
  ctx.requireRole("member");
  const input = productInputSchema.parse(raw);
  await assertSkuFree(ctx, input.sku);
  const vatRateBps = input.vatRateBps ?? (await ctx.business()).defaultVatRateBps;
  const trackStock = input.trackStock ?? input.kind === "product";
  const id = newId("prd");

  for (let attempt = 0; ; attempt++) {
    const slug = await uniqueSlug(ctx, slugify(input.name));
    try {
      await ctx.db.run(
        `INSERT INTO products (id, sku, slug, name, description, kind, unit, price_cents, cost_cents, vat_rate_bps, track_stock, reorder_point, is_public, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, input.sku, slug, input.name, input.description, input.kind, input.unit, input.priceCents, input.costCents, vatRateBps, trackStock ? 1 : 0, input.reorderPoint, input.isPublic ? 1 : 0, input.imageUrl],
      );
      break;
    } catch (error) {
      if (isUniqueError(error, "sku")) throw conflict(`SKU ${input.sku} is already used. Choose another SKU.`);
      // Two products with the same name created at once: pick the next slug.
      if (isUniqueError(error, "slug") && attempt < 3) continue;
      throw error;
    }
  }
  await ctx.audit({ action: "product.created", entityType: "product", entityId: id, summary: `Created ${input.kind} ${input.sku} ${input.name}` });
  return getProduct(ctx, id);
}

const PRODUCT_FIELD_COLUMNS: Record<keyof ProductPatch, string> = {
  sku: "sku", name: "name", description: "description", kind: "kind", unit: "unit", priceCents: "price_cents", costCents: "cost_cents",
  vatRateBps: "vat_rate_bps", trackStock: "track_stock", reorderPoint: "reorder_point", isPublic: "is_public", imageUrl: "image_url",
};

/** Changes only the given fields. The slug stays, so public links keep working after a rename. */
export async function updateProduct(ctx: ModuleContext, id: string, raw: ProductPatch): Promise<Product> {
  ctx.requireRole("member");
  const patch = productPatchSchema.parse(raw);
  const before = await getProduct(ctx, id);
  if (patch.sku !== undefined && patch.sku.toLowerCase() !== before.sku.toLowerCase()) await assertSkuFree(ctx, patch.sku, id);

  const sets: string[] = [];
  const params: SqlValue[] = [];
  const changed: string[] = [];
  for (const [field, value] of Object.entries(patch) as Array<[keyof ProductPatch, unknown]>) {
    if (value === undefined) continue;
    const stored = typeof value === "boolean" ? (value ? 1 : 0) : (value as SqlValue);
    const current = before[field];
    if ((typeof current === "boolean" ? (current ? 1 : 0) : current) === stored) continue;
    sets.push(`${PRODUCT_FIELD_COLUMNS[field]} = ?`);
    params.push(stored);
    changed.push(field);
  }
  if (!sets.length) return before;
  try {
    await ctx.db.run(`UPDATE products SET ${sets.join(", ")}, updated_at = ${NOW} WHERE id = ?`, [...params, id]);
  } catch (error) {
    if (isUniqueError(error, "sku")) throw conflict(`SKU ${patch.sku} is already used. Choose another SKU.`);
    throw error;
  }
  await ctx.audit({ action: "product.updated", entityType: "product", entityId: id, summary: `Updated ${before.sku}: ${changed.join(", ")}` });
  return getProduct(ctx, id);
}

async function setStatus(ctx: ModuleContext, id: string, status: ProductStatus): Promise<Product> {
  ctx.requireRole("member");
  const product = await getProduct(ctx, id);
  if (product.status === status) return product;
  await ctx.db.run(`UPDATE products SET status = ?, updated_at = ${NOW} WHERE id = ?`, [status, id]);
  await ctx.audit({ action: status === "archived" ? "product.archived" : "product.restored", entityType: "product", entityId: id, summary: `${status === "archived" ? "Archived" : "Restored"} ${product.sku} ${product.name}` });
  return getProduct(ctx, id);
}

/** Hides the product from lists, search, the line editor and the public site. Stock history stays. */
export const archiveProduct = (ctx: ModuleContext, id: string) => setStatus(ctx, id, "archived");
export const restoreProduct = (ctx: ModuleContext, id: string) => setStatus(ctx, id, "active");

// Stock

async function getMovement(ctx: ModuleContext, id: string): Promise<Movement | null> {
  return ctx.db.first<Movement>(`SELECT ${MOVEMENT_COLUMNS} FROM ${MOVEMENT_JOINS} WHERE m.id = ?`, [id]);
}

/** Emits stock.low when a tracked product falls from above to at/below its reorder point. */
async function emitIfLow(ctx: ModuleContext, beforeOnHand: number, after: Pick<Product, "id" | "sku" | "trackStock" | "stockOnHand" | "reorderPoint">): Promise<void> {
  if (!after.trackStock || after.reorderPoint <= 0) return;
  if (beforeOnHand > after.reorderPoint && after.stockOnHand <= after.reorderPoint) {
    await ctx.emit("stock.low", { productId: after.id, sku: after.sku, onHand: after.stockOnHand, reorderPoint: after.reorderPoint });
  }
}

/**
 * Records a receipt, return, adjustment or count for a tracked product.
 * The ledger row and the cached stock are written in one batch.
 */
export async function recordMovement(ctx: ModuleContext, productId: string, raw: MovementInput): Promise<MovementResult> {
  const user = ctx.requireRole("member");
  const input = movementInputSchema.parse(raw);
  const before = await getProduct(ctx, productId);
  if (!before.trackStock) throw badRequest(`Stock is not tracked for ${before.name}. Turn on stock tracking first.`);

  const id = newId("mv");
  const insert =
    input.reason === "count"
      ? // The difference is computed from the ledger inside the batch; an unchanged count writes nothing.
        ctx.db.prepare(
          `INSERT INTO stock_movements (id, product_id, quantity, reason, note, created_by)
           SELECT ?, ?, ROUND(? - COALESCE(SUM(quantity), 0), 3), 'count', ?, ? FROM stock_movements WHERE product_id = ?
           HAVING ROUND(? - COALESCE(SUM(quantity), 0), 3) <> 0`,
          [id, productId, roundQuantity(input.countedQuantity), input.note, user.id, productId, roundQuantity(input.countedQuantity)],
        )
      : ctx.db.prepare("INSERT INTO stock_movements (id, product_id, quantity, reason, note, created_by) VALUES (?, ?, ?, ?, ?, ?)", [
          id, productId, roundQuantity(input.quantity), input.reason, input.note, user.id,
        ]);
  await ctx.db.batch([insert, refreshStockStatement(ctx, productId)]);

  const [product, movement] = await Promise.all([getProduct(ctx, productId), getMovement(ctx, id)]);
  const summary =
    input.reason === "count"
      ? `${before.sku}: counted ${roundQuantity(input.countedQuantity)} ${before.unit}${movement ? ` (${signed(movement.quantity)})` : ", no change"}`
      : `${before.sku}: ${signed(roundQuantity(input.quantity))} ${before.unit} (${MOVEMENT_REASON_LABELS[input.reason].toLowerCase()})`;
  await ctx.audit({ action: `stock.${input.reason}`, entityType: "product", entityId: productId, summary, data: input.note ? { note: input.note } : undefined });
  await emitIfLow(ctx, before.stockOnHand, product);
  return { product, movement };
}

export async function listMovements(ctx: ModuleContext, options: { productId?: string; limit?: number } = {}): Promise<Movement[]> {
  ctx.requireRole("member");
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const where = options.productId ? "WHERE m.product_id = ?" : "";
  return ctx.db.all<Movement>(`SELECT ${MOVEMENT_COLUMNS} FROM ${MOVEMENT_JOINS} ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit}`, options.productId ? [options.productId] : []);
}

export async function listLowStock(ctx: ModuleContext, limit = 50): Promise<Product[]> {
  return (await listProducts(ctx, { lowStock: true, limit })).items;
}

// Invoice events

type StockSnapshot = Pick<Product, "id" | "sku" | "trackStock" | "stockOnHand" | "reorderPoint">;

async function stockSnapshots(ctx: ModuleContext, ids: string[]): Promise<Map<string, StockSnapshot>> {
  if (!ids.length) return new Map();
  const rows = await ctx.db.all<Omit<StockSnapshot, "trackStock"> & { trackStock: number }>(
    `SELECT id, sku, track_stock AS trackStock, stock_on_hand AS stockOnHand, reorder_point AS reorderPoint FROM products WHERE id IN (${placeholders(ids.length)})`,
    ids,
  );
  return new Map(rows.map((row) => [row.id, { ...row, trackStock: row.trackStock === 1 }]));
}

async function emitLowAfter(ctx: ModuleContext, before: Map<string, StockSnapshot>): Promise<void> {
  const after = await stockSnapshots(ctx, [...before.keys()]);
  for (const [id, previous] of before) {
    const current = after.get(id);
    if (current) await emitIfLow(ctx, previous.stockOnHand, current);
  }
}

/** Quantity per product id; lines without a product or with no positive quantity are ignored. */
function quantitiesByProduct(lines: readonly StockLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId || !Number.isFinite(line.quantity)) continue;
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [id, quantity] of totals) if (roundQuantity(quantity) <= 0) totals.delete(id);
  return totals;
}

/**
 * invoice.issued: one `sale` movement per tracked product. The partial unique
 * index on (product, 'invoice', invoiceId) makes a repeated event a no-op.
 */
export async function deductInvoiceStock(ctx: ModuleContext, payload: { invoiceId: string; number: string; lines: StockLine[] }): Promise<number> {
  const totals = quantitiesByProduct(payload.lines);
  const snapshots = await stockSnapshots(ctx, [...totals.keys()]);
  const tracked = [...snapshots.values()].filter((product) => product.trackStock);
  if (!tracked.length) return 0;

  const results = await ctx.db.batch(
    tracked.flatMap((product) => [
      ctx.db.prepare(
        `INSERT OR IGNORE INTO stock_movements (id, product_id, quantity, reason, reference_type, reference_id, note, created_by)
         VALUES (?, ?, ?, 'sale', 'invoice', ?, ?, ?)`,
        [newId("mv"), product.id, -roundQuantity(totals.get(product.id) ?? 0), payload.invoiceId, `Invoice ${payload.number}`, ctx.user?.id ?? null],
      ),
      refreshStockStatement(ctx, product.id),
    ]),
  );
  const inserted = results.filter((_, index) => index % 2 === 0).reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
  if (inserted === 0) return 0;
  await ctx.audit({ action: "stock.sale", entityType: "invoice", entityId: payload.invoiceId, summary: `Invoice ${payload.number}: stock deducted for ${inserted} product${inserted === 1 ? "" : "s"}` });
  await emitLowAfter(ctx, new Map(tracked.map((product) => [product.id, product])));
  return inserted;
}

/**
 * invoice.voided: puts back exactly what the invoice took (its `sale`
 * movements) with `return` movements. Each reversal is written at most once.
 */
export async function reverseInvoiceStock(ctx: ModuleContext, payload: { invoiceId: string; number: string }): Promise<number> {
  const sales = await ctx.db.all<{ productId: string; quantity: number }>(
    "SELECT product_id AS productId, quantity FROM stock_movements WHERE reason = 'sale' AND reference_type = 'invoice' AND reference_id = ?",
    [payload.invoiceId],
  );
  if (!sales.length) return 0;
  const results = await ctx.db.batch(
    sales.flatMap((sale) => [
      ctx.db.prepare(
        `INSERT INTO stock_movements (id, product_id, quantity, reason, reference_type, reference_id, note, created_by)
         SELECT ?, ?, ?, 'return', 'invoice_void', ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM stock_movements WHERE product_id = ? AND reference_type = 'invoice_void' AND reference_id = ?)`,
        [newId("mv"), sale.productId, -sale.quantity, payload.invoiceId, `Invoice ${payload.number} voided`, ctx.user?.id ?? null, sale.productId, payload.invoiceId],
      ),
      refreshStockStatement(ctx, sale.productId),
    ]),
  );
  const inserted = results.filter((_, index) => index % 2 === 0).reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
  if (inserted > 0) {
    await ctx.audit({ action: "stock.return", entityType: "invoice", entityId: payload.invoiceId, summary: `Invoice ${payload.number} voided: stock returned for ${inserted} product${inserted === 1 ? "" : "s"}` });
  }
  return inserted;
}

// Metrics and search

export async function lowStockSummary(ctx: ModuleContext): Promise<{ low: number; out: number }> {
  const row = await ctx.db.first<{ low: number; out: number | null }>(`SELECT COUNT(*) AS low, SUM(stock_on_hand <= 0) AS out FROM products WHERE status = 'active' AND ${LOW_STOCK_SQL}`);
  return { low: row?.low ?? 0, out: row?.out ?? 0 };
}

/** Value of stock on hand at cost price, in cents. Negative stock counts as 0. */
export async function stockValue(ctx: ModuleContext): Promise<{ valueCents: number; missingCost: number }> {
  const row = await ctx.db.first<{ value: number | null; missing: number | null }>(
    `SELECT SUM(MAX(stock_on_hand, 0) * cost_cents) AS value, SUM(cost_cents IS NULL AND stock_on_hand > 0) AS missing
     FROM products WHERE status = 'active' AND track_stock = 1`,
  );
  return { valueCents: Math.round(row?.value ?? 0), missingCost: row?.missing ?? 0 };
}

export async function searchProducts(ctx: ModuleContext, term: string): Promise<SearchResult[]> {
  const pattern = likePattern(term);
  const rows = await ctx.db.all<{ id: string; sku: string; name: string; price_cents: number | null }>(
    `SELECT id, sku, name, price_cents FROM products WHERE status = 'active' AND (name LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\') ORDER BY name COLLATE NOCASE LIMIT 8`,
    [pattern, pattern],
  );
  return rows.map((row): SearchResult => ({
    module: "catalog",
    type: "product",
    id: row.id,
    title: row.name,
    subtitle: [row.sku, row.price_cents === null ? null : formatMoney(row.price_cents, ctx.currency, ctx.locale)].filter(Boolean).join(" · "),
    href: `/app/catalog/products/${row.id}`,
  }));
}

// Public website (no sign-in: only active, public products)

export async function listPublicProducts(ctx: ModuleContext): Promise<Product[]> {
  const rows = await ctx.db.all<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE is_public = 1 AND status = 'active' ORDER BY name COLLATE NOCASE LIMIT 500`);
  return rows.map(toProduct);
}

export async function getPublicProduct(ctx: ModuleContext, slug: string): Promise<Product | null> {
  const row = await ctx.db.first<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = ? AND is_public = 1 AND status = 'active'`, [slug]);
  return row ? toProduct(row) : null;
}

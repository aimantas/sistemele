# Catalog module

Products and services with prices, and stock kept as an append-only ledger.
Quotes and invoices pick products from here; issued invoices deduct stock
through events. Optional public pages list products on the website.

- Server: `server/index.ts` (module definition), `service.ts` (all rules), `routes.ts`, `tools.ts`, `site.tsx` (public pages)
- Shared: `shared/schema.ts` (Zod schemas, types, `slugify`, `stockLevel`)
- Client: `client/index.tsx` (nav, routes, widgets), `api.ts` (TanStack Query hooks), pages, `widgets.tsx`
- Migration: `migrations/0003_catalog.sql` · Seed: `seed/03_catalog.sql` · Tests: `tests/catalog.test.ts`

## Rules

- **Money is integer cents, net of VAT.** `price_cents` is the selling price per unit (NULL = price on request); `cost_cents` is what you pay. VAT is `vat_rate_bps` (2100 = 21%) and defaults to the business rate.
- **Stock is a ledger.** Every change is a row in `stock_movements` with a signed `quantity`. `products.stock_on_hand` is a cache, recomputed from `SUM(quantity)` in the same `db.batch` that writes the movement. Never update it any other way.
- **Quantities may be fractional** (2.5 m) and are rounded to 3 decimals.
- Only products with `track_stock = 1` get movements. Services default to untracked.
- Receipts and returns must be positive. Adjustments are signed. A count stores the difference between the counted and the ledger quantity; a count that matches writes nothing. Stock may go below 0 (an invoice can sell what was never received); the UI shows it as out of stock.
- **Low stock** = tracked and `stock_on_hand <= reorder_point` (this includes out of stock).
- The slug is generated from the name on creation (lowercase ASCII; ą→a, č→c, ė→e, š→s, ū→u, ž→z and other accents removed; `-2`, `-3` … on clashes) and does not change on rename, so public links keep working.
- SKUs are unique, case-insensitive, including archived products (409 with the name of the product that has it).
- Archiving hides a product from lists, search, the line editor and the website. History stays; restore brings it back.
- Every write checks `member` role and is audited (`product.*`, `stock.*`).

## Tables

| Table | Purpose |
| --- | --- |
| `products` | Product or service: SKU, slug, name, description, kind, unit, price, cost, VAT, `track_stock`, `stock_on_hand` (cache), `reorder_point`, `is_public`, `image_url`, status. |
| `stock_movements` | Ledger: `quantity` (signed), `reason` (receipt, sale, return, adjustment, count), `reference_type`/`reference_id` (`invoice`, `invoice_void`), note, author. A partial unique index allows one `sale` per product and invoice. |

## API (`/api/catalog`, signed in)

| Method and path | What |
| --- | --- |
| `GET /products?q=&status=active\|archived&kind=product\|service&lowStock=1&limit=&offset=` | `{ items: Product[], total }`. `q` matches name or SKU. Items are a superset of `ProductSummary` (`src/shared/lines.ts`), which the line editor reads with `?q=<term>&limit=6`. |
| `POST /products` | Create. Returns the product (201). |
| `GET /products/:id` | `{ product, movements }` — last 50 movements, newest first, each with `balanceAfter`. |
| `PATCH /products/:id` | Change only the fields sent. Stock cannot be set here. |
| `POST /products/:id/archive`, `/restore` | Change status. |
| `POST /products/:id/movements` | `{ reason: "receipt"\|"return", quantity > 0, note }`, `{ reason: "adjustment", quantity (signed), note }` or `{ reason: "count", countedQuantity, note }`. Returns `{ product, movement }` (201); `movement` is null for an unchanged count. |
| `GET /movements?productId=&limit=` | `{ items: Movement[] }`, newest first, with product name, SKU and unit. |

## MCP tools

`catalog_list_products`, `catalog_get_product`, `catalog_create_product`, `catalog_update_product`,
`catalog_adjust_stock` (receipt, adjustment, count, return), `catalog_list_low_stock`.
Tools that take `productId` also accept a SKU.

## Metrics

| Key | Format | Value |
| --- | --- | --- |
| `catalog.low_stock_count` | number | Active tracked products at or below the reorder point; hint "N out of stock". |
| `catalog.stock_value` | money | `SUM(MAX(stock_on_hand, 0) × cost_cents)` for active tracked products; hint "at cost". |

## Widgets

| Type | Default size | Shows |
| --- | --- | --- |
| `catalog.low-stock` | 2 × 1 | Products at or below their reorder point, linked to the product. |
| `catalog.recent-movements` | 2 × 2 | Latest movements with signed quantity and reason. |

## Events

| Event | Handled how |
| --- | --- |
| `invoice.issued` (handled) | Quantities are summed per `productId`; each tracked product gets one `sale` movement (negative, `reference_type = 'invoice'`) with `INSERT OR IGNORE`, so a repeated event is a no-op. Untracked and unknown products are skipped. |
| `invoice.voided` (handled) | The invoice's `sale` movements are reversed with `return` movements (`reference_type = 'invoice_void'`), each written only if it does not exist yet. |
| `stock.low` (emitted) | When a tracked product with `reorder_point > 0` falls from above to at/below its reorder point, after any movement. Payload: `{ productId, sku, onHand, reorderPoint }`. |

## Public website

- `GET /products` — active products with **Show on the website** on: name, short description, price incl. VAT with the net price beside it, availability (In stock / Out of stock) only for tracked products, link to `/contact` when the CRM module is on. Empty state when nothing is listed.
- `GET /products/:slug` — detail page (404 when missing, private or archived). JSON-LD `BreadcrumbList` always; `Product` (or `Service`) with an `Offer` only when the price is set, `availability` only for tracked products. Answers `Accept: text/markdown`.
- `sitemap()` adds `/products` and every public product URL with `lastmod`. The header link "Products" comes from `siteLinks`.

## Dashboard screens

- `/app/catalog/products` — search, status, type and low-stock filters; New product dialog (also `?new=1` and the quick action).
- `/app/catalog/products/:id` — edit form, stock panel (Receive, Adjust, Count), stock history, archive/restore, link to the public page.
- `/app/catalog/movements` — the ledger (`?productId=` filters to one product).

## Extending

- **New product field:** add a column in a new migration, the field in `productFields` (`shared/schema.ts`), `PRODUCT_COLUMNS` and `PRODUCT_FIELD_COLUMNS` in `service.ts`, the INSERT in `createProduct`, then the form (`client/ProductForm.tsx`).
- **New movement reason:** it needs a migration (the `reason` CHECK), `MOVEMENT_REASONS`/labels in the schema, a branch in `movementInputSchema`, and a badge tone in `client/parts.tsx`.
- **React to stock elsewhere:** handle `stock.low` in another module's `events` (for example, a purchasing task); do not import catalog server code.
- **Reserve stock for quotes:** add a reason or reference type and write movements from a `quote.accepted` handler; keep the cache rule.

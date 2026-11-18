import { z } from "zod";
import { defineTool } from "@/modules/types.server";
import { MANUAL_MOVEMENT_REASONS, PRODUCT_KINDS, PRODUCT_STATUSES, productInputSchema, productPatchSchema } from "../shared/schema";
import * as catalog from "./service";

const UNITS_NOTE = "Money is in integer cents (net, excluding VAT); VAT is in basis points (2100 = 21%); quantities are in the product's `unit` and may be fractional.";

/** Catalog tools for AI agents (MCP). Each wraps a service function. */
export const catalogTools = [
  defineTool({
    name: "catalog_list_products",
    title: "List products",
    description: `Lists products and services, sorted by name. Filter with \`query\` (name or SKU), \`status\` (active by default), \`kind\` or \`lowStock\` (tracked products at or below their reorder point). Returns { items, total }; each item has priceCents, vatRateBps, trackStock, stockOnHand and reorderPoint. ${UNITS_NOTE}`,
    input: z.object({
      query: z.string().max(100).optional(),
      status: z.enum(PRODUCT_STATUSES).default("active"),
      kind: z.enum(PRODUCT_KINDS).optional(),
      lowStock: z.boolean().default(false),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
    readOnly: true,
    run: ({ query, ...rest }, ctx) => catalog.listProducts(ctx, { q: query, ...rest }),
  }),
  defineTool({
    name: "catalog_get_product",
    title: "Get product",
    description: "Returns one product (by id or SKU) with its last 50 stock movements, newest first. Each movement has a signed `quantity` (positive adds stock), a `reason` (receipt, sale, return, adjustment, count) and `balanceAfter`.",
    input: z.object({ productId: z.string().min(1).describe("Product id (prd_…) or SKU") }),
    readOnly: true,
    run: async ({ productId }, ctx) => catalog.getProductDetail(ctx, (await catalog.getProductByIdOrSku(ctx, productId)).id),
  }),
  defineTool({
    name: "catalog_create_product",
    title: "Create product",
    description: `Creates a product or service. Search first with catalog_list_products to avoid duplicates; SKUs must be unique. \`priceCents\` is the net selling price per unit (null = price on request); \`costCents\` is the purchase cost. VAT defaults to the business rate. Stock tracking defaults to on for products and off for services; stock starts at 0 — record a receipt with catalog_adjust_stock. Set \`isPublic\` to list it on the public website. ${UNITS_NOTE}`,
    input: productInputSchema,
    run: (input, ctx) => catalog.createProduct(ctx, input),
  }),
  defineTool({
    name: "catalog_update_product",
    title: "Update product",
    description: `Changes only the given fields of a product (by id or SKU). Stock cannot be set here; use catalog_adjust_stock. The public URL (slug) stays the same after a rename. ${UNITS_NOTE}`,
    input: z.object({ productId: z.string().min(1).describe("Product id (prd_…) or SKU"), changes: productPatchSchema }),
    run: async ({ productId, changes }, ctx) => catalog.updateProduct(ctx, (await catalog.getProductByIdOrSku(ctx, productId)).id, changes),
  }),
  defineTool({
    name: "catalog_adjust_stock",
    title: "Record stock movement",
    description:
      "Records a stock movement for a product with stock tracking on. `reason`: receipt (goods received from a supplier; `quantity` > 0), return (customer return; `quantity` > 0), adjustment (signed change, e.g. -2 for damaged goods), count (physical stock-take: pass `countedQuantity`, the server records the difference). Sales are recorded automatically when an invoice is issued. Returns { product, movement }; movement is null when a count matched the stock on hand.",
    input: z.object({
      productId: z.string().min(1).describe("Product id (prd_…) or SKU"),
      reason: z.enum(MANUAL_MOVEMENT_REASONS),
      quantity: z.number().optional().describe("For receipt, return (positive) and adjustment (signed)."),
      countedQuantity: z.number().min(0).optional().describe("For count: the quantity physically on hand."),
      note: z.string().max(500).default(""),
    }),
    run: async ({ productId, reason, quantity, countedQuantity, note }, ctx) => {
      const product = await catalog.getProductByIdOrSku(ctx, productId);
      return catalog.recordMovement(ctx, product.id, reason === "count" ? { reason, countedQuantity: countedQuantity as number, note } : { reason, quantity: quantity as number, note });
    },
  }),
  defineTool({
    name: "catalog_list_low_stock",
    title: "List low stock",
    description: "Lists active products with stock tracking whose stock on hand is at or below their reorder point (including out of stock), lowest first. Use it to plan purchasing.",
    input: z.object({ limit: z.number().int().min(1).max(200).default(50) }),
    readOnly: true,
    run: async ({ limit }, ctx) => ({ items: await catalog.listLowStock(ctx, limit) }),
  }),
];

import { z } from "zod";
import { slugify as sharedSlugify } from "@/shared/slug";

/**
 * Catalog shapes shared by the API, MCP tools, the public site and the
 * dashboard forms. Money is integer cents, VAT is basis points (2100 = 21%),
 * quantities may be fractional (2.5 m) and are kept to 3 decimals.
 */

export const PRODUCT_KINDS = ["product", "service"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_STATUSES = ["active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Every reason a stock movement can have. `sale` is written by invoice events only. */
export const MOVEMENT_REASONS = ["receipt", "sale", "return", "adjustment", "count"] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** Reasons staff and agents may record by hand. */
export const MANUAL_MOVEMENT_REASONS = ["receipt", "return", "adjustment", "count"] as const;

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  receipt: "Received",
  sale: "Sold",
  return: "Returned",
  adjustment: "Adjusted",
  count: "Counted",
};

const MAX_QUANTITY = 1_000_000_000;
const text = (max: number) => z.string().trim().max(max);
const money = z.number().int("Use whole cents.").min(0, "Enter 0 or more.").max(1_000_000_000);
const quantity = z.number().min(-MAX_QUANTITY).max(MAX_QUANTITY);

/** Rounds a quantity to 3 decimals so float noise never reaches the ledger. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Image shown on the public page: an https:// address or a path on this site. */
const imageUrl = text(500).refine((value) => value === "" || /^https:\/\/\S+$/iu.test(value) || /^\/(?!\/)\S*$/u.test(value), "Use a full https:// address or leave it empty.");

/** Field rules without defaults, so a PATCH never resets fields it did not send. */
const productFields = {
  sku: text(64).min(1, "Enter a SKU (your product code)."),
  name: text(200).min(1, "Enter a name."),
  description: text(5000),
  kind: z.enum(PRODUCT_KINDS),
  unit: text(20).min(1, "Enter a unit, e.g. pcs, m or h."),
  priceCents: money.nullable(),
  costCents: money.nullable(),
  vatRateBps: z.number().int().min(0, "VAT cannot be negative.").max(10_000, "VAT cannot exceed 100%."),
  trackStock: z.boolean(),
  reorderPoint: z.number().min(0, "Enter 0 or more.").max(MAX_QUANTITY),
  isPublic: z.boolean(),
  imageUrl,
};

export const productInputSchema = z.object({
  ...productFields,
  description: productFields.description.default(""),
  kind: productFields.kind.default("product"),
  unit: productFields.unit.default("pcs"),
  priceCents: productFields.priceCents.default(null),
  costCents: productFields.costCents.default(null),
  /** Defaults to the business VAT rate. */
  vatRateBps: productFields.vatRateBps.optional(),
  /** Defaults to true for products and false for services. */
  trackStock: productFields.trackStock.optional(),
  reorderPoint: productFields.reorderPoint.default(0),
  isPublic: productFields.isPublic.default(false),
  imageUrl: productFields.imageUrl.default(""),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const productPatchSchema = z.object(productFields).partial();
export type ProductPatch = z.input<typeof productPatchSchema>;

export const productListQuerySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  kind: z.enum(PRODUCT_KINDS).optional(),
  lowStock: z.enum(["1", "0"]).optional(),
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});

const note = text(500).default("");

/**
 * A stock movement recorded by hand. Receipts and returns add stock and must
 * be positive; an adjustment is a signed change; a count sets the counted
 * quantity and the server records the difference.
 */
const added = quantity.refine((value) => roundQuantity(value) > 0, "Enter a quantity above 0.");

export const movementInputSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("receipt"), quantity: added, note }),
  z.object({ reason: z.literal("return"), quantity: added, note }),
  z.object({ reason: z.literal("adjustment"), quantity: quantity.refine((value) => roundQuantity(value) !== 0, "Enter a change other than 0."), note }),
  z.object({ reason: z.literal("count"), countedQuantity: z.number().min(0, "A count cannot be below 0.").max(MAX_QUANTITY), note }),
]);
export type MovementInput = z.input<typeof movementInputSchema>;

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  kind: ProductKind;
  unit: string;
  priceCents: number | null;
  costCents: number | null;
  vatRateBps: number;
  trackStock: boolean;
  stockOnHand: number;
  reorderPoint: number;
  isPublic: boolean;
  imageUrl: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  /** Signed: positive adds stock, negative removes it. */
  quantity: number;
  reason: MovementReason;
  referenceType: string | null;
  referenceId: string | null;
  note: string;
  createdByName: string | null;
  createdAt: string;
  /** Stock after this movement. Only on a product's own history. */
  balanceAfter?: number;
}

export interface ProductDetail {
  product: Product;
  /** Newest first, at most 50. */
  movements: Movement[];
}

export interface MovementResult {
  product: Product;
  /** null when a count matched the stock on hand (nothing to record). */
  movement: Movement | null;
}

export type StockLevel = "untracked" | "out" | "low" | "ok";

/** Stock badge rule used by the dashboard, widgets and the public site. */
export function stockLevel(product: Pick<Product, "trackStock" | "stockOnHand" | "reorderPoint">): StockLevel {
  if (!product.trackStock) return "untracked";
  if (product.stockOnHand <= 0) return "out";
  if (product.stockOnHand <= product.reorderPoint) return "low";
  return "ok";
}

/** URL slug from a product name; see `slugify` in src/shared/slug.ts. Never empty. */
export function slugify(value: string): string {
  return sharedSlugify(value, "product");
}

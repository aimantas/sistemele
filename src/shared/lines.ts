import { z } from "zod";
import { documentTotals, lineSubtotalCents, type DocumentTotals } from "./money";

/**
 * Line items shared by quotes and invoices (and any future document module).
 * Quantities may be fractional (2.5 h). Money in cents, VAT/discount in bps.
 */
export const lineInputSchema = z.object({
  productId: z.string().nullable().default(null),
  description: z.string().trim().min(1, "Describe the line.").max(500),
  quantity: z.number().positive("Quantity must be more than 0.").max(1_000_000),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  unitPriceCents: z.number().int().min(0).max(1_000_000_000),
  vatRateBps: z.number().int().min(0).max(10_000),
  discountBps: z.number().int().min(0).max(10_000).default(0),
});
export type LineInput = z.input<typeof lineInputSchema>;
export type Line = z.output<typeof lineInputSchema>;

export const linesSchema = z.array(lineInputSchema).min(1, "Add at least one line.").max(200);

export interface StoredLine extends Line {
  id: string;
  position: number;
  subtotalCents: number;
}

/** Server-side: validated lines with computed subtotals, plus document totals. */
export function priceLines(lines: Line[]): { lines: Array<Line & { position: number; subtotalCents: number }>; totals: DocumentTotals } {
  const priced = lines.map((line, index) => ({ ...line, position: index + 1, subtotalCents: lineSubtotalCents(line) }));
  return { lines: priced, totals: documentTotals(lines) };
}

/** What the line editor needs from the catalog module (GET /api/catalog/products?q=). */
export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  unit: string;
  priceCents: number | null;
  vatRateBps: number;
  kind: "product" | "service";
  trackStock: boolean;
  stockOnHand: number;
}

/** Seller/buyer snapshot printed on documents. */
export interface PartySnapshot {
  name: string;
  companyCode: string;
  vatCode: string;
  address: string;
  email: string;
  phone: string;
}

/**
 * Cross-module events. A module emits with `ctx.emit(name, payload)` and other
 * modules react in their `events` map, so modules never import each other.
 * Add new events here with a payload type; keep payloads small (ids, amounts).
 */
export interface StockLine {
  productId: string | null;
  quantity: number;
}

export interface SistemeleEvents {
  "contact.created": { contactId: string; source: string };
  "deal.stage_changed": { dealId: string; contactId: string; from: string; to: string };
  "lead.created": { leadId: string; source: string };
  "lead.converted": { leadId: string; contactId: string; dealId: string | null };
  "quote.sent": { quoteId: string; contactId: string; dealId: string | null; number: string };
  "quote.accepted": { quoteId: string; contactId: string; dealId: string | null; number: string; totalCents: number };
  "quote.declined": { quoteId: string; contactId: string; dealId: string | null; number: string };
  "invoice.issued": { invoiceId: string; contactId: string; number: string; totalCents: number; lines: StockLine[] };
  "invoice.paid": { invoiceId: string; contactId: string; number: string; totalCents: number };
  "invoice.voided": { invoiceId: string; contactId: string; number: string; lines: StockLine[] };
  "stock.low": { productId: string; sku: string; onHand: number; reorderPoint: number };
  /** A page or post was published or scheduled; `publishedAt` may be in the future. */
  "content.published": { entryId: string; type: "page" | "post"; path: string; publishedAt: string };
}

export type EventName = keyof SistemeleEvents;

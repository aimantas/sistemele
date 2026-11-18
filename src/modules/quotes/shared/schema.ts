import { z } from "zod";
import { lineInputSchema, type PartySnapshot, type StoredLine } from "@/shared/lines";
import type { VatGroup } from "@/shared/money";

/** Quote shapes shared by the API, MCP tools and the dashboard screens. */

/**
 * `expired` is never stored: a sent quote whose `validUntil` is before today
 * (in the business time zone) is reported as expired and cannot be accepted.
 */
export const QUOTE_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "Expired" },
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["id"];
export const quoteStatusIds = QUOTE_STATUSES.map((status) => status.id) as [QuoteStatus, ...QuoteStatus[]];

export function quoteStatusLabel(status: QuoteStatus): string {
  return QUOTE_STATUSES.find((item) => item.id === status)?.label ?? status;
}

/** Stored status + validity → the status every API response reports. */
export function effectiveQuoteStatus(stored: string, validUntil: string, today: string): QuoteStatus {
  if (stored === "expired" || (stored === "sent" && validUntil < today)) return "expired";
  return stored as QuoteStatus;
}

export const QUOTE_VALIDITY_DAYS = 30;

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.iso.date("Use the YYYY-MM-DD format.");

/** A quote line. `vatRateBps` may be left out: the business default rate is used. */
export const quoteLineInputSchema = lineInputSchema.extend({ vatRateBps: z.number().int().min(0).max(10_000).optional() });
export const quoteLinesSchema = z.array(quoteLineInputSchema).min(1, "Add at least one line.").max(200);

/** Create input. Totals are never accepted: the server prices every line. */
export const quoteInputSchema = z.object({
  contactId: z.string().trim().min(1, "Choose a contact.").max(80),
  dealId: z.string().trim().max(80).nullable().optional(),
  issueDate: isoDate.optional(),
  validUntil: isoDate.optional(),
  notes: text(5000).default(""),
  terms: text(5000).default(""),
  lines: quoteLinesSchema,
});
export type QuoteInput = z.input<typeof quoteInputSchema>;

/** Draft edits: send only what changes. `lines` replaces every line. */
export const quotePatchSchema = z.object({
  contactId: z.string().trim().min(1, "Choose a contact.").max(80).optional(),
  dealId: z.string().trim().max(80).nullable().optional(),
  issueDate: isoDate.optional(),
  validUntil: isoDate.optional(),
  notes: text(5000).optional(),
  terms: text(5000).optional(),
  lines: quoteLinesSchema.optional(),
});
export type QuotePatch = z.input<typeof quotePatchSchema>;

export const quoteSendSchema = z.object({ message: text(2000).default("") });
export type QuoteSendInput = z.input<typeof quoteSendSchema>;

export const quoteMarkSchema = z.object({ status: z.enum(["accepted", "declined"]) });
export type QuoteMarkInput = z.input<typeof quoteMarkSchema>;

/** List filter. `awaiting` = every sent quote, expired included, oldest sent first. */
export const quoteListStatuses = [...quoteStatusIds, "awaiting"] as const;
export type QuoteListStatus = (typeof quoteListStatuses)[number];

export interface Quote {
  id: string;
  number: string;
  contactId: string;
  contactName: string;
  dealId: string | null;
  dealTitle: string | null;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  currency: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  notes: string;
  terms: string;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type QuoteLine = StoredLine;

export interface QuoteDetail extends Quote {
  lines: QuoteLine[];
  vatGroups: VatGroup[];
  contact: { id: string; name: string; email: string; archived: boolean };
  /** Current business profile (seller) and contact (buyer) as printed on the quote. */
  seller: PartySnapshot;
  buyer: PartySnapshot;
  /** A non-void invoice created from this quote, if any. */
  invoiceId: string | null;
}

export interface QuoteSendResult {
  quote: QuoteDetail;
  /** The customer link. Shown once: only its hash is stored. */
  publicUrl: string;
  emailStatus: "sent" | "logged" | "failed";
}

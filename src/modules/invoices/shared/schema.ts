import { z } from "zod";
import { linesSchema, type PartySnapshot, type StoredLine } from "@/shared/lines";
import type { VatGroup } from "@/shared/money";
import { patchSchema } from "@/shared/zod";

/** Invoice shapes shared by the API, MCP tools and the dashboard screens. */

export const INVOICE_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "issued", label: "Issued" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["id"];

/** List filters: the stored statuses plus the derived "overdue" (issued, due date passed). */
export const INVOICE_FILTERS = ["draft", "issued", "overdue", "paid", "void"] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];

export const PAYMENT_METHODS = [
  { id: "bank_transfer", label: "Bank transfer" },
  { id: "card", label: "Card" },
  { id: "cash", label: "Cash" },
  { id: "other", label: "Other" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export const paymentMethodIds = PAYMENT_METHODS.map((method) => method.id) as [PaymentMethod, ...PaymentMethod[]];

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.iso.date("Use a date like 2026-11-18.");
const optionalDate = z.union([z.literal(""), isoDate]).nullable().optional();

export const invoiceInputSchema = z.object({
  contactId: z.string().min(1, "Choose a contact."),
  /** Optional on drafts; issuing defaults it to issue date + payment terms. */
  dueDate: optionalDate,
  notes: text(5000).default(""),
  lines: linesSchema,
});
export type InvoiceInput = z.input<typeof invoiceInputSchema>;
/** Only the fields sent are changed (defaults are not re-applied). */
export const invoicePatchSchema = patchSchema(invoiceInputSchema);
export type InvoicePatch = z.input<typeof invoicePatchSchema>;

export const issueInputSchema = z.object({
  issueDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  /** Email the invoice link to the contact right after issuing. */
  send: z.boolean().default(false),
});
export type IssueInput = z.input<typeof issueInputSchema>;

export const paymentInputSchema = z.object({
  amountCents: z.number().int("Enter whole cents.").positive("Enter an amount above 0.").max(100_000_000_000),
  paidOn: isoDate,
  method: z.enum(paymentMethodIds).default("bank_transfer"),
  reference: text(200).default(""),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

export const voidInputSchema = z.object({
  reason: text(500).min(1, "Say why the invoice is void."),
});

export const listQuerySchema = z.object({
  status: z.enum(INVOICE_FILTERS).optional(),
  contactId: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type InvoiceListQuery = z.input<typeof listQuerySchema>;

/** Seller printed on the invoice: business details plus where to pay. */
export interface SellerSnapshot extends PartySnapshot {
  bank: { name: string; iban: string };
  /** Business → Invoice footer at the time of issue. */
  footer: string;
}

export interface Invoice {
  id: string;
  /** Null until issued. */
  number: string | null;
  contactId: string;
  contactName: string;
  quoteId: string | null;
  status: InvoiceStatus;
  /** Issued and the due date has passed. */
  overdue: boolean;
  daysOverdue: number;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  paidCents: number;
  /** What the customer still owes: 0 when paid or void. */
  amountDueCents: number;
  notes: string;
  voidReason: string;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceLine = StoredLine;

export interface InvoicePayment {
  id: string;
  amountCents: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  createdByName: string | null;
  createdAt: string;
}

export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  vatGroups: VatGroup[];
  payments: InvoicePayment[];
  contact: { id: string; name: string; email: string };
  quoteNumber: string | null;
  /** Snapshots once issued; a live preview from Settings and the contact while a draft. */
  seller: SellerSnapshot;
  buyer: PartySnapshot;
  /** True once the invoice was sent; the link itself is only shown right after sending. */
  hasPublicLink: boolean;
}

export interface InvoiceActionResult {
  invoice: InvoiceDetail;
  /** The customer link. Only returned when this call (re)sent it; links are stored hashed. */
  publicUrl: string | null;
  emailStatus?: "sent" | "logged" | "failed";
}

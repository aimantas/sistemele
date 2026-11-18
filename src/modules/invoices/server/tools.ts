import { z } from "zod";
import { linesSchema } from "@/shared/lines";
import { defineTool } from "@/modules/types.server";
import { AppError } from "@/worker/lib/errors";
import { INVOICE_FILTERS, paymentMethodIds } from "../shared/schema";
import * as invoices from "./service";

const date = (what: string) => z.iso.date().describe(`${what} as YYYY-MM-DD.`);

/** Invoice tools for AI agents (MCP). Each wraps a service function. */
export const invoicesTools = [
  defineTool({
    name: "invoices_list",
    title: "List invoices",
    description:
      "Lists invoices, newest first. Filter by `status` (draft, issued, overdue, paid, void; overdue = issued with the due date passed), `contactId`, or `query` (invoice number or contact name). Amounts are integer cents. Each item has amountDueCents and overdue. Returns { items, total }.",
    input: z.object({
      status: z.enum(INVOICE_FILTERS).optional(),
      contactId: z.string().optional(),
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
    readOnly: true,
    run: ({ query, ...rest }, ctx) => invoices.listInvoices(ctx, { ...rest, q: query }),
  }),
  defineTool({
    name: "invoices_get",
    title: "Get invoice",
    description: "Returns one invoice with its lines, VAT breakdown, payments, seller and buyer details and the source quote number. Amounts are integer cents.",
    input: z.object({ invoiceId: z.string() }),
    readOnly: true,
    run: ({ invoiceId }, ctx) => invoices.getInvoice(ctx, invoiceId),
  }),
  defineTool({
    name: "invoices_create_draft",
    title: "Create draft invoice",
    description:
      "Creates a draft invoice (no number yet, still editable) for a CRM contact. Find the contact first with crm_list_contacts. Lines: unitPriceCents is the net unit price in cents, vatRateBps is VAT in basis points (2100 = 21%), discountBps likewise; set productId when the line is a catalog product so stock moves on issue. `dueDate` is optional (YYYY-MM-DD); issuing defaults it to the payment terms. Totals are calculated by the server.",
    input: z.object({
      contactId: z.string(),
      dueDate: date("Due date").optional(),
      notes: z.string().max(5000).default("").describe("Printed on the invoice."),
      lines: linesSchema,
    }),
    run: (input, ctx) => invoices.createDraft(ctx, input),
  }),
  defineTool({
    name: "invoices_create_from_quote",
    title: "Invoice an accepted quote",
    description:
      "Creates a draft invoice from an accepted quote, copying its contact, lines and notes. Fails if the quote is not accepted, or if a non-void invoice already exists for it (the error names it). Review the draft, then issue it with invoices_issue.",
    input: z.object({ quoteId: z.string() }),
    run: async ({ quoteId }, ctx) => {
      try {
        return await invoices.createFromQuote(ctx, quoteId);
      } catch (error) {
        if (error instanceof invoices.InvoiceExistsError) throw new AppError(409, "conflict", `${error.message} Open it with invoices_get using invoiceId "${error.invoiceId}".`);
        throw error;
      }
    },
  }),
  defineTool({
    name: "invoices_issue",
    title: "Issue invoice",
    description:
      "Issues a draft invoice: assigns the next gap-free number (e.g. INV-2026-0007), snapshots seller and buyer details and locks it. Irreversible: an issued invoice can never be edited or deleted, only voided by an admin. Confirm the lines and totals with the user first. `issueDate` defaults to today and `dueDate` to issue date + payment terms (both YYYY-MM-DD). Set `send: true` to email the customer a private link at once. Returns { invoice, publicUrl }.",
    input: z.object({
      invoiceId: z.string(),
      issueDate: date("Issue date").optional(),
      dueDate: date("Due date").optional(),
      send: z.boolean().default(false),
    }),
    run: ({ invoiceId, ...input }, ctx) => invoices.issueInvoice(ctx, invoiceId, input),
  }),
  defineTool({
    name: "invoices_send",
    title: "Email invoice",
    description:
      "Emails an issued invoice to the contact's email address with a private link and bank transfer details. Sends a real email; each send replaces the previous link. The contact must have an email. Returns { invoice, publicUrl, emailStatus }.",
    input: z.object({ invoiceId: z.string() }),
    run: ({ invoiceId }, ctx) => invoices.sendInvoice(ctx, invoiceId),
  }),
  defineTool({
    name: "invoices_record_payment",
    title: "Record payment",
    description:
      "Records money received against an issued invoice. `amountCents` is in integer cents and cannot exceed amountDueCents (check with invoices_get). `paidOn` is YYYY-MM-DD. When payments cover the total, the invoice becomes paid. Returns the updated invoice.",
    input: z.object({
      invoiceId: z.string(),
      amountCents: z.number().int().positive(),
      paidOn: date("Date the money arrived"),
      method: z.enum(paymentMethodIds).default("bank_transfer"),
      reference: z.string().max(200).default("").describe("Bank reference or receipt number."),
    }),
    run: ({ invoiceId, ...payment }, ctx) => invoices.recordPayment(ctx, invoiceId, payment),
  }),
];

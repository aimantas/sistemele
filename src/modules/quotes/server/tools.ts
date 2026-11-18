import { z } from "zod";
import { defineTool } from "@/modules/types.server";
import { quoteInputSchema, quoteListStatuses, quoteMarkSchema, quotePatchSchema } from "../shared/schema";
import * as quotes from "./service";

const MONEY_NOTE = "Money is integer cents (1250 = 12.50), VAT and discounts are basis points (2100 = 21%), dates are YYYY-MM-DD.";

/** Quote tools for AI agents (MCP). Each wraps a service function. */
export const quotesTools = [
  defineTool({
    name: "quotes_list",
    title: "List quotes",
    description:
      "Lists quotes, newest first, with contactName and totals in cents. Filter by `status` (draft, sent, accepted, declined, expired; `awaiting` = every sent quote, oldest first), `contactId`, or `query` (quote number or contact name). Returns { items, total }.",
    input: z.object({
      status: z.enum(quoteListStatuses).optional(),
      contactId: z.string().optional(),
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
    readOnly: true,
    run: ({ query, ...rest }, ctx) => quotes.listQuotes(ctx, { ...rest, q: query }),
  }),
  defineTool({
    name: "quotes_get",
    title: "Get quote",
    description: "Returns one quote with its lines, VAT groups, seller and buyer details, status and `invoiceId` when an invoice was made from it.",
    input: z.object({ quoteId: z.string() }),
    readOnly: true,
    run: ({ quoteId }, ctx) => quotes.getQuote(ctx, quoteId),
  }),
  defineTool({
    name: "quotes_create",
    title: "Create quote",
    description: `Creates a draft quote for a CRM contact (find it with crm_list_contacts first; pass dealId to link a deal of that contact). Each line needs description, quantity and unitPriceCents; vatRateBps defaults to the business rate, unit to "pcs". Totals are calculated by the server. Issue date defaults to today and validity to 30 days. Nothing is sent: review, then call quotes_send. ${MONEY_NOTE}`,
    input: quoteInputSchema,
    run: (input, ctx) => quotes.createQuote(ctx, input),
  }),
  defineTool({
    name: "quotes_update_draft",
    title: "Update draft quote",
    description: `Changes a draft quote. Pass only the fields that change; \`lines\` replaces every line. Sent quotes must be revised in the dashboard first; accepted and declined quotes are locked. ${MONEY_NOTE}`,
    input: z.object({ quoteId: z.string(), changes: quotePatchSchema }),
    run: ({ quoteId, changes }, ctx) => quotes.updateQuote(ctx, quoteId, changes),
  }),
  defineTool({
    name: "quotes_send",
    title: "Send quote",
    description:
      "Emails the quote to the contact's email address with a private link where the customer accepts or declines. Only send after the user confirms. Sending again makes a new link and the old one stops working. Returns { quote, publicUrl, emailStatus }; treat publicUrl as private.",
    input: z.object({ quoteId: z.string(), message: z.string().max(2000).optional().describe("Optional personal note above the quote link.") }),
    run: ({ quoteId, message }, ctx) => quotes.sendQuote(ctx, quoteId, { message }),
  }),
  defineTool({
    name: "quotes_mark",
    title: "Record customer answer",
    description: "Records that the customer accepted or declined a quote outside the link (phone, email, in person). Accepted moves the linked CRM deal to won. The quote is locked afterwards.",
    input: quoteMarkSchema.extend({ quoteId: z.string() }),
    run: ({ quoteId, status }, ctx) => quotes.markQuote(ctx, quoteId, { status }),
  }),
];

import type { SearchResult } from "@/shared/api";
import type { ServerModule } from "@/modules/types.server";
import { likePattern } from "@/worker/lib/db";
import { effectiveQuoteStatus, type Quote } from "../shared/schema";
import { quotesApi, quotesPublicApi } from "./routes";
import { acceptanceRate, describeQuote, openQuotes, today } from "./service";
import { quotesSite } from "./site";
import { quotesTools } from "./tools";

/**
 * Quotes module: priced offers sent to CRM contacts, answered online through a
 * private link. See src/modules/quotes/README.md.
 */
export const quotesModule: ServerModule = {
  id: "quotes",
  name: "Quotes",
  description: "Priced offers customers open and accept online.",
  requires: ["crm"],
  api: quotesApi,
  publicApi: quotesPublicApi,
  site: quotesSite,
  tools: quotesTools,

  metrics: [
    {
      key: "quotes.open_value",
      label: "Open quotes",
      description: "Total value (with VAT) of sent quotes that have not expired.",
      format: "money",
      async compute(ctx) {
        const { count, valueCents } = await openQuotes(ctx);
        return { value: valueCents, hint: `${count} awaiting answer` };
      },
    },
    {
      key: "quotes.acceptance_rate_90d",
      label: "Quote acceptance (90 days)",
      description: "Accepted quotes divided by all quotes answered in the last 90 days.",
      format: "percent",
      async compute(ctx) {
        const { rate, answered } = await acceptanceRate(ctx, 90);
        return { value: rate, hint: `${answered} answered` };
      },
    },
  ],

  async search(term, ctx) {
    const pattern = likePattern(term);
    const rows = await ctx.db.all<Pick<Quote, "id" | "number" | "status" | "validUntil" | "contactName" | "totalCents" | "currency">>(
      `SELECT q.id, q.number, q.status, q.valid_until AS validUntil, c.name AS contactName, q.total_cents AS totalCents, q.currency
       FROM quotes q JOIN contacts c ON c.id = q.contact_id
       WHERE q.number LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' ORDER BY q.created_at DESC LIMIT 8`,
      [pattern, pattern],
    );
    const day = today(ctx);
    return rows.map(
      (row): SearchResult => ({
        module: "quotes",
        type: "quote",
        id: row.id,
        title: `Quote ${row.number}`,
        subtitle: describeQuote({ ...row, status: effectiveQuoteStatus(row.status, row.validUntil, day) }, ctx.locale),
        href: `/app/quotes/${row.id}`,
      }),
    );
  },
};

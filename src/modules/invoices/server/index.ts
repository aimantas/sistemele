import type { SearchResult } from "@/shared/api";
import { formatMoney } from "@/shared/money";
import type { ServerModule } from "@/modules/types.server";
import { INVOICE_STATUSES } from "../shared/schema";
import { invoicesApi } from "./routes";
import { invoiceTotals, searchInvoices } from "./service";
import { invoicesSite } from "./site";
import { invoicesTools } from "./tools";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Invoices module: numbered VAT invoices issued from drafts or accepted
 * quotes, payments, overdue tracking and a private customer link.
 * See src/modules/invoices/README.md.
 */
export const invoicesModule: ServerModule = {
  id: "invoices",
  name: "Invoices",
  description: "Numbered VAT invoices, payments and overdue tracking.",
  requires: ["crm"],
  api: invoicesApi,
  site: invoicesSite,
  tools: invoicesTools,

  metrics: [
    {
      key: "invoices.revenue_30d",
      label: "Invoiced (30 days)",
      description: "Total of issued and paid invoices dated in the last 30 days, VAT included.",
      format: "money",
      async compute(ctx) {
        const { count, cents } = await invoiceTotals(ctx, "revenue_30d");
        return { value: cents, hint: plural(count, "invoice") };
      },
    },
    {
      key: "invoices.outstanding",
      label: "Outstanding",
      description: "What customers still owe on issued invoices.",
      format: "money",
      async compute(ctx) {
        const { count, cents } = await invoiceTotals(ctx, "outstanding");
        return { value: cents, hint: `${plural(count, "invoice")} open` };
      },
    },
    {
      key: "invoices.overdue_amount",
      label: "Overdue",
      description: "What customers owe on issued invoices past their due date.",
      format: "money",
      async compute(ctx) {
        const { count, cents } = await invoiceTotals(ctx, "overdue");
        return { value: cents, hint: `${count} overdue` };
      },
    },
  ],

  async search(term, ctx) {
    const rows = await searchInvoices(ctx, term);
    return rows.map(
      (row): SearchResult => ({
        module: "invoices",
        type: "invoice",
        id: row.id,
        title: row.number ?? "Draft invoice",
        subtitle: `${row.contactName} · ${formatMoney(row.totalCents, row.currency, ctx.locale)} · ${INVOICE_STATUSES.find((s) => s.id === row.status)?.label ?? row.status}`,
        href: `/app/invoices/${row.id}`,
      }),
    );
  },
};

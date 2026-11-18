import type { SearchResult } from "@/shared/api";
import { formatMoney } from "@/shared/money";
import type { ServerModule } from "@/modules/types.server";
import { likePattern } from "@/worker/lib/db";
import { crmApi, crmPublicApi } from "./routes";
import { addSystemActivity, openPipeline } from "./service";
import { crmTools } from "./tools";

/**
 * CRM module — the reference implementation every other module follows.
 * See src/modules/crm/README.md.
 */
export const crmModule: ServerModule = {
  id: "crm",
  name: "CRM",
  description: "Contacts, deals on a drag-and-drop pipeline, notes, tasks and website requests.",
  api: crmApi,
  publicApi: crmPublicApi,
  tools: crmTools,

  metrics: [
    {
      key: "crm.open_pipeline_value",
      label: "Open pipeline",
      description: "Total value of deals in lead, qualified and proposal stages.",
      format: "money",
      async compute(ctx) {
        const { count, valueCents } = await openPipeline(ctx);
        return { value: valueCents, hint: `${count} open deal${count === 1 ? "" : "s"}` };
      },
    },
    {
      key: "crm.new_contacts_30d",
      label: "New contacts (30 days)",
      description: "Contacts created in the last 30 days.",
      format: "number",
      async compute(ctx) {
        const value = await ctx.db.value<number>("SELECT COUNT(*) FROM contacts WHERE archived_at IS NULL AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')");
        const web = await ctx.db.value<number>("SELECT COUNT(*) FROM contacts WHERE source = 'website' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')");
        return { value: value ?? 0, hint: `${web ?? 0} from the website` };
      },
    },
    {
      key: "crm.win_rate_90d",
      label: "Win rate (90 days)",
      description: "Won deals divided by all deals closed in the last 90 days.",
      format: "percent",
      async compute(ctx) {
        const row = await ctx.db.first<{ won: number; closed: number }>(
          "SELECT SUM(stage = 'won') AS won, COUNT(*) AS closed FROM deals WHERE closed_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')",
        );
        const closed = row?.closed ?? 0;
        return { value: closed ? (row?.won ?? 0) / closed : 0, hint: `${closed} closed` };
      },
    },
    {
      key: "crm.open_tasks",
      label: "Open tasks",
      description: "Tasks not done yet; the hint counts overdue ones.",
      format: "number",
      async compute(ctx) {
        const row = await ctx.db.first<{ open: number; overdue: number }>(
          "SELECT COUNT(*) AS open, SUM(due_at IS NOT NULL AND due_at < strftime('%Y-%m-%d', 'now')) AS overdue FROM activities WHERE kind = 'task' AND done_at IS NULL",
        );
        return { value: row?.open ?? 0, hint: `${row?.overdue ?? 0} overdue` };
      },
    },
  ],

  events: {
    async "quote.sent"({ contactId, dealId, number }, ctx) {
      if (dealId) await ctx.db.run("UPDATE deals SET stage = 'proposal', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND stage IN ('lead', 'qualified')", [dealId]);
      await addSystemActivity(ctx, contactId, dealId, `Quote ${number} sent.`);
    },
    async "quote.accepted"({ contactId, dealId, number, totalCents }, ctx) {
      if (dealId) {
        await ctx.db.run(
          "UPDATE deals SET stage = 'won', value_cents = CASE WHEN value_cents = 0 THEN ? ELSE value_cents END, closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND stage <> 'won'",
          [totalCents, dealId],
        );
      }
      await addSystemActivity(ctx, contactId, dealId, `Quote ${number} accepted (${formatMoney(totalCents, ctx.currency, ctx.locale)}).`);
    },
    async "quote.declined"({ contactId, dealId, number }, ctx) {
      await addSystemActivity(ctx, contactId, dealId, `Quote ${number} declined.`);
    },
    async "invoice.issued"({ contactId, number, totalCents }, ctx) {
      await addSystemActivity(ctx, contactId, null, `Invoice ${number} issued (${formatMoney(totalCents, ctx.currency, ctx.locale)}).`);
    },
    async "invoice.paid"({ contactId, number }, ctx) {
      await addSystemActivity(ctx, contactId, null, `Invoice ${number} paid.`);
    },
  },

  async search(term, ctx) {
    const pattern = likePattern(term);
    const rows = await ctx.db.all<{ id: string; name: string; email: string; company_name: string }>(
      `SELECT id, name, email, company_name FROM contacts WHERE archived_at IS NULL AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 8`,
      [pattern, pattern, pattern],
    );
    return rows.map((row): SearchResult => ({ module: "crm", type: "contact", id: row.id, title: row.name, subtitle: row.email || row.company_name, href: `/app/crm/contacts/${row.id}` }));
  },
};

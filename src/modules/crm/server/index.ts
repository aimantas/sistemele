import type { SearchResult } from "@/shared/api";
import { formatMoney } from "@/shared/money";
import type { ServerModule } from "@/modules/types.server";
import { likePattern } from "@/worker/lib/db";
import { QUOTE_SENT_STAGE_ID } from "../shared/schema";
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
  description: "Leads inbox, contacts, deals on a drag-and-drop pipeline with your own stages, notes, tasks and website requests.",
  api: crmApi,
  publicApi: crmPublicApi,
  tools: crmTools,

  metrics: [
    {
      key: "crm.open_pipeline_value",
      label: "Open pipeline",
      description: "Total value of deals in open stages.",
      format: "money",
      async compute(ctx) {
        const { count, valueCents } = await openPipeline(ctx);
        return { value: valueCents, hint: `${count} open deal${count === 1 ? "" : "s"}` };
      },
    },
    {
      key: "crm.weighted_pipeline_value",
      label: "Weighted pipeline",
      description: "Open deal values multiplied by their stage's win probability.",
      format: "money",
      async compute(ctx) {
        const { weightedCents, valueCents } = await openPipeline(ctx);
        return { value: weightedCents, hint: valueCents ? `${Math.round((weightedCents / valueCents) * 100)}% of the open value` : "No open deals" };
      },
    },
    {
      key: "crm.open_leads",
      label: "Open leads",
      description: "Leads that are new, contacted or qualified; the hint counts follow-ups due.",
      format: "number",
      async compute(ctx) {
        const row = await ctx.db.first<{ open: number; due: number }>(
          "SELECT COUNT(*) AS open, COALESCE(SUM(follow_up_on IS NOT NULL AND follow_up_on <= strftime('%Y-%m-%d', 'now')), 0) AS due FROM leads WHERE status IN ('new', 'contacted', 'qualified')",
        );
        return { value: row?.open ?? 0, hint: `${row?.due ?? 0} follow-up${row?.due === 1 ? "" : "s"} due` };
      },
    },
    {
      key: "crm.new_leads_30d",
      label: "New leads (30 days)",
      description: "Leads created in the last 30 days.",
      format: "number",
      async compute(ctx) {
        const row = await ctx.db.first<{ total: number; web: number }>(
          "SELECT COUNT(*) AS total, COALESCE(SUM(source = 'website'), 0) AS web FROM leads WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')",
        );
        return { value: row?.total ?? 0, hint: `${row?.web ?? 0} from the website` };
      },
    },
    {
      key: "crm.lead_conversion_90d",
      label: "Lead conversion (90 days)",
      description: "Leads created in the last 90 days that were converted into customers.",
      format: "percent",
      async compute(ctx) {
        const row = await ctx.db.first<{ converted: number; total: number }>(
          "SELECT COALESCE(SUM(status = 'converted'), 0) AS converted, COUNT(*) AS total FROM leads WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')",
        );
        const total = row?.total ?? 0;
        return { value: total ? (row?.converted ?? 0) / total : 0, hint: `${row?.converted ?? 0} of ${total} leads` };
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
          "SELECT COALESCE(SUM(s.kind = 'won'), 0) AS won, COUNT(*) AS closed FROM deals d JOIN pipeline_stages s ON s.id = d.stage WHERE s.kind <> 'open' AND d.closed_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')",
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
    // A sent quote moves the deal to the "proposal" stage when it exists and the deal sits in an earlier open stage.
    async "quote.sent"({ contactId, dealId, number }, ctx) {
      if (dealId) {
        await ctx.db.run(
          `UPDATE deals SET stage = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?2
             AND stage IN (SELECT s.id FROM pipeline_stages s, pipeline_stages target WHERE target.id = ?1 AND target.kind = 'open' AND s.kind = 'open' AND s.position < target.position)`,
          [QUOTE_SENT_STAGE_ID, dealId],
        );
      }
      await addSystemActivity(ctx, contactId, dealId, `Quote ${number} sent.`);
    },
    async "quote.accepted"({ contactId, dealId, number, totalCents }, ctx) {
      if (dealId) {
        await ctx.db.run(
          `UPDATE deals SET stage = won.id, value_cents = CASE WHEN value_cents = 0 THEN ? ELSE value_cents END, lost_reason = '',
             closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           FROM (SELECT id FROM pipeline_stages WHERE kind = 'won' ORDER BY position LIMIT 1) AS won
           WHERE deals.id = ? AND deals.stage <> won.id`,
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
    const [contacts, leads] = await Promise.all([
      ctx.db.all<{ id: string; name: string; email: string; company_name: string }>(
        `SELECT id, name, email, company_name FROM contacts WHERE archived_at IS NULL AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 8`,
        [pattern, pattern, pattern],
      ),
      ctx.db.all<{ id: string; name: string; email: string; company: string; status: string }>(
        `SELECT id, name, email, company, status FROM leads WHERE status <> 'converted' AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 5`,
        [pattern, pattern, pattern],
      ),
    ]);
    return [
      ...contacts.map((row): SearchResult => ({ module: "crm", type: "contact", id: row.id, title: row.name, subtitle: row.email || row.company_name, href: `/app/crm/contacts/${row.id}` })),
      ...leads.map((row): SearchResult => ({ module: "crm", type: "lead", id: row.id, title: row.name, subtitle: [row.company, `${row.status} lead`].filter(Boolean).join(" · "), href: `/app/crm/leads/${row.id}` })),
    ];
  },
};

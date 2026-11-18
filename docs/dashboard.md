# Dashboard

The dashboard at `/app` is a grid of cards. Each person arranges their own:
**Customize** → drag cards (mouse, touch or keyboard: focus the handle, Space,
arrows, Space), resize with **Narrower / Wider / Taller**, remove, **Add card**,
or start from a **Template**. **Save layout** stores it in `dashboard_layouts`
for that user. **Reset** returns to the default (the first template).

```text
4 columns on wide screens · 2 on tablets · 1 on phones
card size = { w: 1–4 columns, h: 1–2 rows }
```

## Pieces

| Piece | File |
| --- | --- |
| Grid, customize mode, dialogs | `src/app/dashboard/DashboardPage.tsx` |
| Widget registry (core + modules) | `src/app/dashboard/registry.ts` |
| Core widgets: KPI, Getting started, Quick actions, Note | `src/app/dashboard/core-widgets.tsx` |
| Templates | `src/app/dashboard/templates.ts` |
| Module widgets | `src/modules/<id>/client/widgets.tsx`, registered in `client/index.tsx` |
| KPI metrics (server) | `metrics` in `src/modules/<id>/server/index.ts` |
| Layout API | `GET/PUT/DELETE /api/dashboard/layout` |

## Two kinds of cards

1. **KPI cards** (`core.metric`) show one number from any module's `metrics`. Adding a metric on the server makes it available in Add card → Numbers with no client code.
2. **Widgets** are React components a module ships: lists, charts, mini boards.

## Recipe: add a KPI

`src/modules/invoices/server/index.ts`:

```ts
metrics: [
  {
    key: "invoices.average_invoice_90d",
    label: "Average invoice (90 days)",
    description: "Average total of invoices issued in the last 90 days.",
    format: "money",
    async compute(ctx) {
      const row = await ctx.db.first<{ avg: number | null; n: number }>(
        "SELECT AVG(total_cents) AS avg, COUNT(*) AS n FROM invoices WHERE status IN ('issued','paid') AND issue_date >= date('now','-90 days')",
      );
      return { value: Math.round(row?.avg ?? 0), hint: `${row?.n ?? 0} invoices` };
    },
  },
],
```

## Recipe: add a widget

1. Component in `src/modules/<id>/client/widgets.tsx`. Fetch with the module's hooks; render `Spinner` while loading and a one-line empty state. Keep it small: a few rows and a link to the full screen.
2. Register it in `src/modules/<id>/client/index.tsx`:

   ```ts
   widgets: [
     {
       type: "invoices.revenue-by-month",      // stable forever: saved layouts reference it
       title: "Revenue by month",
       description: "Invoiced net revenue for the last 12 months.",
       defaultSize: { w: 2, h: 1 },
       component: lazy(() => import("./widgets").then((m) => ({ default: m.RevenueByMonthWidget }))),
     },
   ],
   ```

3. If it needs new data, add a service + route on the server (or a metric).
4. Optional: put it in a template.

Widget props: `{ config, size }`. `config` is per-card settings saved in the
layout (the Note card stores its text there; KPI cards store `metric`).

## Recipe: add a template

Append to `dashboardTemplates` in `src/app/dashboard/templates.ts`:

```ts
{
  id: "finance",
  name: "Finance",
  description: "Cash in, cash owed, overdue invoices.",
  widgets: [
    { type: "core.metric", size: { w: 1, h: 1 }, config: { metric: "invoices.revenue_30d" } },
    { type: "core.metric", size: { w: 1, h: 1 }, config: { metric: "invoices.outstanding" } },
    { type: "invoices.overdue", size: { w: 2, h: 2 } },
  ],
},
```

Cards for disabled modules are skipped automatically.

## Prompts for an AI agent

Paste into Claude Code, Codex or Cursor in this repository:

- “Add a dashboard widget `crm.deals-closing-soon` listing open deals with an expected close date in the next 14 days. Follow docs/dashboard.md, add it to the Sales template, and add a test for any new endpoint.”
- “Add a KPI metric for average days to payment over the last 90 days in the invoices module.”
- “Create a dashboard template called Workshop with stock, recent movements and open tasks.”
- “Make the Pipeline widget a stacked bar chart without adding a chart library.”

In Claude Code the `/add-widget` and `/add-dashboard-template` commands run these
recipes with the checks included.

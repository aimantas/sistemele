import type { DashboardLayout, WidgetSize } from "@/shared/api";

/**
 * Dashboard templates. A template is a starting layout a user can apply from
 * Customize → Templates. Widgets whose module is disabled are skipped.
 *
 * Agents: to add a template, append an object here. Widget `type` must match
 * a WidgetDefinition.type (see `npm run doctor` or src/app/dashboard/registry.ts).
 * Metric cards use type "core.metric" with config { metric: "<metric key>" }.
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  widgets: Array<{ type: string; size: WidgetSize; config?: Record<string, unknown> }>;
}

const metric = (key: string) => ({ type: "core.metric", size: { w: 1, h: 1 } as WidgetSize, config: { metric: key } });

export const dashboardTemplates: DashboardTemplate[] = [
  {
    id: "owner",
    name: "Owner overview",
    description: "Money in, money owed, pipeline and stock in one view. The default.",
    widgets: [
      { type: "core.getting-started", size: { w: 4, h: 1 } },
      metric("invoices.revenue_30d"),
      metric("invoices.outstanding"),
      metric("crm.open_pipeline_value"),
      metric("quotes.open_value"),
      { type: "crm.pipeline", size: { w: 2, h: 1 } },
      { type: "invoices.overdue", size: { w: 2, h: 1 } },
      { type: "crm.open-tasks", size: { w: 2, h: 2 } },
      { type: "catalog.low-stock", size: { w: 2, h: 1 } },
      { type: "core.quick-actions", size: { w: 2, h: 1 } },
    ],
  },
  {
    id: "sales",
    name: "Sales",
    description: "Leads, deals, quotes waiting for an answer and follow-up tasks.",
    widgets: [
      metric("crm.open_pipeline_value"),
      metric("crm.win_rate_90d"),
      metric("quotes.open_value"),
      metric("crm.new_contacts_30d"),
      { type: "crm.pipeline", size: { w: 4, h: 1 } },
      { type: "quotes.awaiting", size: { w: 2, h: 2 } },
      { type: "crm.open-tasks", size: { w: 2, h: 2 } },
      { type: "crm.recent-contacts", size: { w: 2, h: 1 } },
      { type: "core.quick-actions", size: { w: 2, h: 1 } },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    description: "Stock levels, recent movements and invoices to chase.",
    widgets: [
      metric("catalog.low_stock_count"),
      metric("catalog.stock_value"),
      metric("invoices.overdue_amount"),
      metric("invoices.outstanding"),
      { type: "catalog.low-stock", size: { w: 2, h: 2 } },
      { type: "catalog.recent-movements", size: { w: 2, h: 2 } },
      { type: "invoices.overdue", size: { w: 4, h: 1 } },
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Three numbers and a note. Build your own from here.",
    widgets: [metric("invoices.revenue_30d"), metric("invoices.outstanding"), metric("crm.open_pipeline_value"), { type: "core.note", size: { w: 1, h: 1 }, config: { text: "Write a note for your team here." } }],
  },
];

export function layoutFromTemplate(template: DashboardTemplate, knownTypes: Set<string>, knownMetrics?: Set<string>): DashboardLayout {
  return {
    version: 1,
    widgets: template.widgets
      .filter((widget) => knownTypes.has(widget.type))
      .filter((widget) => widget.type !== "core.metric" || !knownMetrics || knownMetrics.has(String(widget.config?.metric)))
      .map((widget) => ({ id: crypto.randomUUID().slice(0, 8), type: widget.type, size: widget.size, config: widget.config })),
  };
}

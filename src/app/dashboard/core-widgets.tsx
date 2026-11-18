import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { Link } from "react-router";
import type { MetricValue } from "@/shared/api";
import { clientModules } from "@/modules/client";
import type { WidgetDefinition, WidgetProps } from "@/modules/types.client";
import { api } from "../lib/api";
import { useFormat } from "../lib/format";
import { useAppInfo, useCan } from "../lib/session";
import { Spinner } from "../ui";

export interface MetricsResponse {
  items: MetricValue[];
  available: Array<{ key: string; label: string; description: string; format: MetricValue["format"] }>;
}

/** All metrics in one request; every KPI card reads from this cache. */
export function useMetrics() {
  return useQuery({ queryKey: ["metrics"], queryFn: () => api.get<MetricsResponse>("/api/metrics"), staleTime: 60_000 });
}

function MetricWidget({ config }: WidgetProps) {
  const { data, isLoading } = useMetrics();
  const format = useFormat();
  const metric = data?.items.find((item) => item.key === config.metric);
  if (isLoading) return <Spinner />;
  if (!metric) return <p className="text-sm text-muted">This metric is not available. Remove the card or pick another.</p>;
  const value = metric.format === "money" ? format.money(metric.value) : metric.format === "percent" ? format.percent(metric.value) : format.number(metric.value);
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <p className="text-sm font-medium text-ink-soft">{metric.label}</p>
      <p className="tabular text-3xl font-semibold tracking-tight">{value}</p>
      {metric.hint ? <p className="text-sm text-muted">{metric.hint}</p> : <span />}
    </div>
  );
}

function NoteWidget({ config }: WidgetProps) {
  return <p className="text-sm whitespace-pre-line text-ink-soft">{String(config.text ?? "Empty note. Edit it in Customize.")}</p>;
}

function QuickActionsWidget() {
  const actions = clientModules.flatMap((module) => module.quickActions ?? []);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => (
        <Link key={action.to} to={action.to} className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm font-medium hover:border-line-strong hover:bg-paper">
          <action.icon className="size-4 text-brand" />
          {action.label}
        </Link>
      ))}
      {actions.length === 0 ? <p className="text-sm text-muted">Enable a module to get quick actions.</p> : null}
    </div>
  );
}

function GettingStartedWidget() {
  const info = useAppInfo();
  const isAdmin = useCan("admin");
  const business = useQuery({ queryKey: ["settings", "business"], queryFn: () => api.get<{ business: { iban: string; vatCode: string; email: string } }>("/api/settings/business") });
  const team = useQuery({ queryKey: ["users"], queryFn: () => api.get<{ items: unknown[] }>("/api/users"), enabled: isAdmin });
  const tokens = useQuery({ queryKey: ["api-tokens"], queryFn: () => api.get<{ items: unknown[] }>("/api/api-tokens") });
  const steps = [
    { done: Boolean(business.data?.business.email && business.data.business.iban), label: "Add business and bank details", to: "/app/settings" },
    { done: Boolean(info?.emailConfigured), label: "Connect Resend to send email", to: "/app/settings/email" },
    { done: (team.data?.items.length ?? 0) > 1, label: "Invite your team", to: "/app/settings/team" },
    { done: (tokens.data?.items.length ?? 0) > 0, label: "Connect an AI agent (MCP)", to: "/app/settings/api" },
  ];
  const remaining = steps.filter((step) => !step.done).length;
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-sm text-ink-soft">{remaining === 0 ? "Setup complete. Remove this card in Customize." : `${remaining} of ${steps.length} setup steps left.`}</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <li key={step.label}>
            <Link to={step.to} className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm hover:border-line-strong hover:bg-paper">
              {step.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted" />}
              <span className={step.done ? "text-muted line-through" : "font-medium"}>{step.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const coreWidgets: WidgetDefinition[] = [
  { type: "core.metric", title: "KPI", description: "One number from any module, e.g. revenue or open pipeline.", defaultSize: { w: 1, h: 1 }, bare: true, component: MetricWidget },
  { type: "core.getting-started", title: "Getting started", description: "Setup checklist for a new installation.", defaultSize: { w: 4, h: 1 }, component: GettingStartedWidget },
  { type: "core.quick-actions", title: "Quick actions", description: "Shortcuts to create contacts, quotes, invoices and products.", defaultSize: { w: 2, h: 1 }, component: QuickActionsWidget },
  { type: "core.note", title: "Note", description: "A short pinned note for the team.", defaultSize: { w: 1, h: 1 }, component: NoteWidget },
];

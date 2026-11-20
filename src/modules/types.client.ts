import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import type { WidgetSize } from "@/shared/api";
import type { Role } from "@/shared/auth";

export interface NavItem {
  /** Absolute SPA path, e.g. "/app/crm/contacts". */
  to: string;
  label: string;
  icon: LucideIcon;
  minRole?: Role;
}

export interface WidgetProps {
  /** Per-instance settings saved with the layout (e.g. which metric to show). */
  config: Record<string, unknown>;
  size: WidgetSize;
}

/**
 * A dashboard card a module offers. Users add, move and resize instances in
 * the dashboard's Customize mode; layouts are saved per user in D1.
 */
export interface WidgetDefinition {
  /** "<module>.<name>", e.g. "crm.pipeline". Never rename: saved layouts reference it. */
  type: string;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  minRole?: Role;
  /** Hide the title bar outside Customize mode (KPI cards carry their own label). */
  bare?: boolean;
  /** Lazy-load with React.lazy so the dashboard stays fast. */
  component: ComponentType<WidgetProps>;
}

export interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

/**
 * What the admin panel's developer panel (dev mode) shows for one page: where
 * it lives in the code and ready-to-copy tasks for a coding agent. Every route
 * a module adds needs one (tests/dev-panel.test.ts checks it).
 */
export interface DevPage {
  /** The route path as in `routes` ("crm/leads/:id"); "" is the dashboard. */
  path: string;
  title: string;
  /** What the page is for, one sentence. */
  summary: string;
  /** Repository files behind the page, most relevant first. */
  files: Array<{ path: string; note: string }>;
  /** MCP tools that do the same job, for agents working on live data. */
  tools?: string[];
  /** Starter tasks for a coding agent: one imperative sentence each. */
  prompts: string[];
}

export interface ClientModule {
  id: string;
  name: string;
  /** Sidebar entries. */
  nav: NavItem[];
  /** Routes under /app, with paths relative to it: { path: "crm/contacts", lazy: … }. */
  routes: RouteObject[];
  widgets?: WidgetDefinition[];
  /** Shown in the command palette (Ctrl/Cmd+K) and the Quick actions widget. */
  quickActions?: QuickAction[];
  /** Developer panel notes and agent prompts, one per route. */
  dev?: DevPage[];
}

import type { Hono } from "hono";
import type { ReactNode } from "react";
import type { z } from "zod";
import type { SearchResult } from "@/shared/api";
import type { Role, SessionUser } from "@/shared/auth";
import type { BusinessProfile } from "@/shared/business";
import type { OutgoingEmail, EmailStatus } from "@/worker/email/send";
import type { AppEnv, Env } from "@/worker/env";
import type { Db } from "@/worker/lib/db";
import type { EventName, SistemeleEvents } from "./events";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  data?: unknown;
}

/**
 * Everything a module service needs, built once per request. Pass it to
 * services instead of Hono's `c`, so REST routes, MCP tools, event handlers
 * and tests all call the same functions.
 */
export interface ModuleContext {
  env: Env;
  db: Db;
  /** null on public routes (contact form, quote link). */
  user: SessionUser | null;
  locale: string;
  currency: string;
  timezone: string;
  /** Throws 401/403 unless the acting user has at least this role. Returns the user. */
  requireRole(minimum: Role): SessionUser;
  audit(entry: AuditEntry): Promise<void>;
  emit<E extends EventName>(event: E, payload: SistemeleEvents[E]): Promise<void>;
  business(): Promise<BusinessProfile>;
  sendEmail(email: OutgoingEmail): Promise<{ status: EmailStatus; id: string }>;
  /** Run work after the response is sent (Cloudflare `waitUntil`). */
  waitUntil(promise: Promise<unknown>): void;
}

export interface ToolDefinition<S extends z.ZodObject = z.ZodObject> {
  /** snake_case, prefixed with the module id: "crm_list_contacts". */
  name: string;
  title: string;
  /** Written for an AI agent: what it does, when to use it, what it returns. */
  description: string;
  input: S;
  /** Default "member". */
  minRole?: Role;
  /** True when the tool never changes data. */
  readOnly?: boolean;
  run(input: z.infer<S>, ctx: ModuleContext): Promise<unknown>;
}

export function defineTool<S extends z.ZodObject>(tool: ToolDefinition<S>): ToolDefinition<S> {
  return tool;
}

export interface MetricDefinition {
  /** "<module>.<name>", e.g. "crm.open_pipeline_value". */
  key: string;
  label: string;
  description: string;
  format: "number" | "money" | "percent";
  minRole?: Role;
  compute(ctx: ModuleContext): Promise<{ value: number; hint?: string }>;
}

export interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

/** A block a module adds to the public home page, below the hero. */
export interface HomeSection {
  /** Stable id, used as the React key. */
  id: string;
  /** Server-rendered markup (no client JavaScript). */
  body: ReactNode;
  /** The same content for agents (Accept: text/markdown). */
  markdown: string;
}

/** What a module adds to the public home page. */
export interface HomeContribution {
  /** Replaces the default headline, lead and description from src/worker/site/content.ts. The first module that sets it wins. */
  hero?: { title: string; lead: string; description: string; image?: string };
  sections?: HomeSection[];
}

export type EventHandlers = {
  [E in EventName]?: (payload: SistemeleEvents[E], ctx: ModuleContext) => Promise<void>;
};

export interface ServerModule {
  id: string;
  name: string;
  description: string;
  /** Module ids that must be enabled too, e.g. quotes requires crm. */
  requires?: string[];
  /** Mounted at /api/<id>. Every request is signed in (session or API token). */
  api?: Hono<AppEnv>;
  /** Mounted at /api/public/<id>. No sign-in: validate input and rate-limit. */
  publicApi?: Hono<AppEnv>;
  /** Public server-rendered pages, mounted at "/". Use renderPage() from @/worker/site/render. */
  site?: Hono<AppEnv>;
  /** Links added to the public site header, e.g. { label: "Products", href: "/products" }. */
  siteLinks?: Array<{ label: string; href: string }>;
  /** Header links that depend on data (e.g. pages placed in the menu), read on each public page view. Keep it to one fast query. */
  siteMenu?(ctx: ModuleContext): Promise<Array<{ label: string; href: string }>>;
  /** Exposed over MCP at /mcp and listed in llms.txt. */
  tools?: ToolDefinition[];
  /** Numbers the dashboard can show as KPI cards. */
  metrics?: MetricDefinition[];
  /** Reactions to other modules' events. Errors are logged, never thrown to the emitter. */
  events?: EventHandlers;
  /** Global search (Cmd/Ctrl+K in the dashboard). */
  search?(term: string, ctx: ModuleContext): Promise<SearchResult[]>;
  /** Public URLs for sitemap.xml. */
  sitemap?(ctx: ModuleContext): Promise<SitemapEntry[]>;
  /** Hero text and sections for the public home page. Read on each home page view; keep it to a query or two. */
  home?(ctx: ModuleContext): Promise<HomeContribution>;
}

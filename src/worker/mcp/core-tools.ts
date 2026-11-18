import { z } from "zod";
import type { SearchResult } from "@/shared/api";
import { roleAtLeast } from "@/shared/auth";
import { defineTool, type ServerModule, type ToolDefinition } from "@/modules/types.server";

/** Tools every installation has, whatever modules are enabled. */
export function coreTools(modules: readonly ServerModule[]): ToolDefinition[] {
  return [
    defineTool({
      name: "core_whoami",
      title: "Who am I",
      description: "Returns the signed-in user, their role and the enabled modules. Call this first to learn what you can do.",
      input: z.object({}),
      readOnly: true,
      async run(_input, ctx) {
        return { user: ctx.user, modules: modules.map(({ id, name, description }) => ({ id, name, description })), currency: ctx.currency, locale: ctx.locale };
      },
    }),
    defineTool({
      name: "core_business_profile",
      title: "Business profile",
      description: "Returns the seller details used on quotes and invoices: legal name, codes, address, bank account, default VAT rate and payment terms.",
      input: z.object({}),
      readOnly: true,
      async run(_input, ctx) {
        return ctx.business();
      },
    }),
    defineTool({
      name: "core_search",
      title: "Search everything",
      description: "Searches contacts, products, quotes and invoices by name, email, SKU or number. Returns ids you can pass to the module tools.",
      input: z.object({ query: z.string().min(2).max(100) }),
      readOnly: true,
      async run({ query }, ctx) {
        const results = await Promise.all(modules.map((module) => module.search?.(query, ctx) ?? Promise.resolve([] as SearchResult[])));
        return { items: results.flat().slice(0, 30) };
      },
    }),
    defineTool({
      name: "core_metrics",
      title: "Business metrics",
      description: "Returns the current value of every KPI metric (pipeline value, overdue invoices, low stock …). Optionally pass keys to limit the list.",
      input: z.object({ keys: z.array(z.string()).optional() }),
      readOnly: true,
      async run({ keys }, ctx) {
        const user = ctx.requireRole("member");
        const metrics = modules
          .flatMap((module) => module.metrics ?? [])
          .filter((metric) => roleAtLeast(user.role, metric.minRole ?? "member"))
          .filter((metric) => !keys?.length || keys.includes(metric.key));
        return { items: await Promise.all(metrics.map(async (metric) => ({ key: metric.key, label: metric.label, format: metric.format, ...(await metric.compute(ctx)) }))) };
      },
    }),
  ];
}

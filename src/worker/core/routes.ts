import { Hono } from "hono";
import { z } from "zod";
import { config } from "../../../sistemele.config";
import type { DashboardLayout, MetricValue, SearchResult } from "@/shared/api";
import { ROLES, roleAtLeast } from "@/shared/auth";
import { brandingSchema } from "@/shared/branding";
import { businessProfileSchema } from "@/shared/business";
import { newId } from "@/shared/ids";
import type { ServerModule } from "@/modules/types.server";
import { getContext } from "../context";
import { renderEmail } from "../email/layout";
import { emailConfigured } from "../email/send";
import { appOrigin, type AppEnv } from "../env";
import { randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { parseJsonColumn } from "../lib/db";
import { getBranding, putSetting } from "../lib/settings";
import { sanitizeSvg } from "../lib/svg";
import { listTeam } from "../lib/team";
import { logoUrl } from "../site/brand";
import { readJson, readQuery } from "../lib/validate";

const userInviteSchema = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  name: z.string().trim().max(120).default(""),
  role: z.enum(ROLES).default("member"),
});
const userUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});
const tokenCreateSchema = z.object({ name: z.string().trim().min(1).max(80), role: z.enum(ROLES).default("member") });
const layoutSchema = z.object({
  version: z.literal(1),
  widgets: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        type: z.string().min(1).max(80),
        size: z.object({ w: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), h: z.union([z.literal(1), z.literal(2)]) }),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(40),
});

/** Authenticated core API: profile, team, settings, tokens, audit, dashboard, metrics, search. */
export function coreRoutes(modules: readonly ServerModule[]) {
  return new Hono<AppEnv>()
    .get("/app", (c) =>
      c.json({
        appName: c.env.APP_NAME,
        environment: c.env.APP_ENV,
        locale: config.locale,
        currency: config.currency,
        modules: modules.map(({ id, name, description }) => ({ id, name, description })),
        emailConfigured: emailConfigured(c.env),
      }),
    )

    .get("/me", (c) => c.json({ user: getContext(c).requireRole("member") }))
    .patch("/me", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      const { name } = await readJson(c, z.object({ name: z.string().trim().min(1).max(120) }));
      await ctx.db.run("UPDATE users SET name = ? WHERE id = ?", [name, user.id]);
      return c.json({ user: { ...user, name } });
    })

    // Team
    .get("/team", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("member");
      return c.json({ items: await listTeam(ctx.db) });
    })
    .get("/users", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("admin");
      const users = await ctx.db.all("SELECT id, email, name, role, status, created_at AS createdAt, last_login_at AS lastLoginAt FROM users ORDER BY created_at");
      return c.json({ items: users });
    })
    .post("/users", async (c) => {
      const ctx = getContext(c);
      const actor = ctx.requireRole("admin");
      const input = await readJson(c, userInviteSchema);
      if (input.role === "owner" && actor.role !== "owner") throw forbidden("Only an owner can add another owner.");
      const exists = await ctx.db.value("SELECT id FROM users WHERE email = ?", [input.email]);
      if (exists) throw conflict("A user with this email already exists.");
      const id = newId("usr");
      await ctx.db.run("INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)", [id, input.email, input.name, input.role]);
      const business = await ctx.business();
      const content = renderEmail({
        preheader: `${actor.name || actor.email} added you to ${business.name}.`,
        heading: `You have access to ${c.env.APP_NAME}`,
        paragraphs: [`${actor.name || actor.email} added you to ${business.name}. Sign in with this email address; we will send you a one-time link.`],
        action: { label: "Open sign-in page", url: `${appOrigin(c.env)}/app/login` },
        footer: `${c.env.APP_NAME} · ${appOrigin(c.env)}`,
      });
      await ctx.sendEmail({ to: input.email, subject: `You have access to ${c.env.APP_NAME}`, template: "core.user_invited", ...content });
      await ctx.audit({ action: "user.created", entityType: "user", entityId: id, summary: `Added ${input.email} as ${input.role}` });
      return c.json({ id }, 201);
    })
    .patch("/users/:id", async (c) => {
      const ctx = getContext(c);
      const actor = ctx.requireRole("admin");
      const input = await readJson(c, userUpdateSchema);
      const target = await ctx.db.first<{ id: string; role: string; email: string }>("SELECT id, role, email FROM users WHERE id = ?", [c.req.param("id")]);
      if (!target) throw notFound("User");
      if ((target.role === "owner" || input.role === "owner") && actor.role !== "owner") throw forbidden("Only an owner can change owners.");
      if (target.id === actor.id && (input.status === "disabled" || (input.role && input.role !== actor.role))) {
        throw badRequest("You cannot disable or demote yourself. Ask another owner.");
      }
      if (target.role === "owner" && (input.role && input.role !== "owner" || input.status === "disabled")) {
        const owners = await ctx.db.value<number>("SELECT COUNT(*) FROM users WHERE role = 'owner' AND status = 'active'");
        if ((owners ?? 0) <= 1) throw badRequest("Keep at least one active owner.");
      }
      await ctx.db.batch([
        ctx.db.prepare("UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?", [input.name ?? null, input.role ?? null, input.status ?? null, target.id]),
        ...(input.status === "disabled" ? [ctx.db.prepare("DELETE FROM sessions WHERE user_id = ?", [target.id])] : []),
      ]);
      await ctx.audit({ action: "user.updated", entityType: "user", entityId: target.id, summary: `Updated ${target.email}`, data: input });
      return c.json({ ok: true });
    })

    // Business settings
    .get("/settings/business", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("member");
      return c.json({ business: await ctx.business() });
    })
    .put("/settings/business", async (c) => {
      const ctx = getContext(c);
      const actor = ctx.requireRole("admin");
      const business = await readJson(c, businessProfileSchema);
      await putSetting(ctx.db, "business", business, actor.id);
      await ctx.audit({ action: "settings.updated", entityType: "settings", entityId: "business", summary: "Updated business details" });
      return c.json({ business });
    })

    // Brand: logo (SVG markup, no file upload), colours, surface, corners
    .get("/settings/branding", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("member");
      const branding = await getBranding(ctx.db);
      return c.json({ branding, logoUrl: await logoUrl(branding.logoSvg) });
    })
    .put("/settings/branding", async (c) => {
      const ctx = getContext(c);
      const actor = ctx.requireRole("admin");
      const input = await readJson(c, brandingSchema);
      const branding = { ...input, logoSvg: input.logoSvg?.trim() ? sanitizeSvg(input.logoSvg) : null };
      await putSetting(ctx.db, "branding", branding, actor.id);
      await ctx.audit({ action: "settings.updated", entityType: "settings", entityId: "branding", summary: `Updated brand (${branding.brandColor}, ${branding.surface}, ${branding.corners}${branding.logoSvg ? ", logo" : ""})` });
      return c.json({ branding, logoUrl: await logoUrl(branding.logoSvg) });
    })

    // API tokens for agents, MCP clients and scripts
    .get("/api-tokens", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      const items = await ctx.db.all(
        `SELECT id, name, token_prefix AS prefix, role, created_at AS createdAt, last_used_at AS lastUsedAt
         FROM api_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
        [user.id],
      );
      return c.json({ items });
    })
    .post("/api-tokens", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      if (user.via === "token") throw forbidden("Create API tokens from the dashboard, not with another token.");
      const input = await readJson(c, tokenCreateSchema);
      if (!roleAtLeast(user.role, input.role)) throw forbidden("A token cannot have more access than you.");
      const token = `sk_${randomToken(24)}`;
      const id = newId("tok");
      await ctx.db.run("INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, role) VALUES (?, ?, ?, ?, ?, ?)", [
        id,
        user.id,
        input.name,
        await sha256Hex(token),
        token.slice(0, 10),
        input.role,
      ]);
      await ctx.audit({ action: "api_token.created", entityType: "api_token", entityId: id, summary: `Created API token "${input.name}" (${input.role})` });
      // The full token is shown once. Only its hash is stored.
      return c.json({ id, token }, 201);
    })
    .delete("/api-tokens/:id", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      const result = await ctx.db.run(
        "UPDATE api_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
        [c.req.param("id"), user.id],
      );
      if (!result.meta.changes) throw notFound("API token");
      await ctx.audit({ action: "api_token.revoked", entityType: "api_token", entityId: c.req.param("id"), summary: "Revoked API token" });
      return c.json({ ok: true });
    })

    // Audit trail
    .get("/audit", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("admin");
      const query = readQuery(c, z.object({ entityType: z.string().max(40).optional(), entityId: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }));
      const where: string[] = [];
      const params: string[] = [];
      if (query.entityType) {
        where.push("entity_type = ?");
        params.push(query.entityType);
      }
      if (query.entityId) {
        where.push("entity_id = ?");
        params.push(query.entityId);
      }
      const items = await ctx.db.all(
        `SELECT id, actor_label AS actor, action, entity_type AS entityType, entity_id AS entityId, summary, created_at AS createdAt
         FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ${query.limit}`,
        params,
      );
      return c.json({ items });
    })

    // Dashboard layout per user
    .get("/dashboard/layout", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      const row = await ctx.db.first<{ layout: string }>("SELECT layout FROM dashboard_layouts WHERE user_id = ?", [user.id]);
      return c.json({ layout: row ? parseJsonColumn<DashboardLayout | null>(row.layout, null) : null });
    })
    .put("/dashboard/layout", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      const layout = await readJson(c, layoutSchema);
      await ctx.db.run(
        `INSERT INTO dashboard_layouts (user_id, layout) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET layout = excluded.layout, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        [user.id, JSON.stringify(layout)],
      );
      return c.json({ layout });
    })
    .delete("/dashboard/layout", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      await ctx.db.run("DELETE FROM dashboard_layouts WHERE user_id = ?", [user.id]);
      return c.json({ ok: true });
    })

    // KPI metrics contributed by modules
    .get("/metrics", async (c) => {
      const ctx = getContext(c);
      const user = ctx.requireRole("member");
      const keys = (c.req.query("keys") ?? "").split(",").filter(Boolean);
      const definitions = modules.flatMap((module) => module.metrics ?? []).filter((metric) => roleAtLeast(user.role, metric.minRole ?? "member"));
      const selected = keys.length ? definitions.filter((metric) => keys.includes(metric.key)) : definitions;
      const items: MetricValue[] = await Promise.all(
        selected.map(async (metric) => ({ key: metric.key, label: metric.label, format: metric.format, ...(await metric.compute(ctx)) })),
      );
      return c.json({ items, available: definitions.map(({ key, label, description, format }) => ({ key, label, description, format })) });
    })

    // Global search across modules
    .get("/search", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("member");
      const term = (c.req.query("q") ?? "").trim().slice(0, 100);
      if (term.length < 2) return c.json({ items: [] });
      const results = await Promise.all(modules.map((module) => module.search?.(term, ctx) ?? Promise.resolve([] as SearchResult[])));
      return c.json({ items: results.flat().slice(0, 30) });
    })

    // Email log (delivery troubleshooting)
    .get("/email-log", async (c) => {
      const ctx = getContext(c);
      ctx.requireRole("admin");
      const items = await ctx.db.all(
        `SELECT id, to_address AS "to", subject, template, status, error, related_type AS relatedType, related_id AS relatedId, created_at AS createdAt
         FROM email_log ORDER BY created_at DESC LIMIT 100`,
      );
      return c.json({ items });
    });
}

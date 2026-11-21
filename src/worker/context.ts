import type { Context } from "hono";
import { config } from "../../sistemele.config";
import { roleAtLeast, type Role, type SessionUser } from "@/shared/auth";
import { newId } from "@/shared/ids";
import type { EventName, SistemeleEvents } from "@/modules/events";
import type { AuditEntry, ModuleContext, ServerModule } from "@/modules/types.server";
import { sendEmail } from "./email/send";
import type { AppEnv, Env } from "./env";
import { Db } from "./lib/db";
import { forbidden, tooManyRequests, unauthorized } from "./lib/errors";
import { consumeRateLimit } from "./lib/rate-limit";
import { getBusinessProfile } from "./lib/settings";

export interface ContextInput {
  env: Env;
  user: SessionUser | null;
  modules: readonly ServerModule[];
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function createModuleContext(input: ContextInput): ModuleContext {
  const db = new Db(input.env.DB);
  let businessCache: ReturnType<ModuleContext["business"]> | null = null;

  const ctx: ModuleContext = {
    env: input.env,
    db,
    user: input.user,
    locale: config.locale,
    currency: config.currency,
    timezone: config.timezone,

    requireRole(minimum: Role): SessionUser {
      if (!input.user) throw unauthorized();
      if (!roleAtLeast(input.user.role, minimum)) throw forbidden();
      return input.user;
    },

    async audit(entry: AuditEntry): Promise<void> {
      await db.run(
        `INSERT INTO audit_log (id, actor_id, actor_label, action, entity_type, entity_id, summary, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId("aud"),
          input.user?.id ?? null,
          input.user ? input.user.name || input.user.email : "Public",
          entry.action,
          entry.entityType,
          entry.entityId ?? null,
          entry.summary.slice(0, 500),
          entry.data === undefined ? null : JSON.stringify(entry.data),
        ],
      );
    },

    async emit<E extends EventName>(event: E, payload: SistemeleEvents[E]): Promise<void> {
      for (const module of input.modules) {
        const handler = module.events?.[event];
        if (!handler) continue;
        try {
          await handler(payload, ctx);
        } catch (error) {
          console.error(`[events] ${module.id} failed on ${event}`, error);
          await ctx
            .audit({ action: "event.failed", entityType: "event", entityId: event, summary: `${module.id} could not process ${event}`, data: { message: error instanceof Error ? error.message : String(error) } })
            .catch(() => undefined);
        }
      }
    },

    business() {
      businessCache ??= getBusinessProfile(db);
      return businessCache;
    },

    async sendEmail(email) {
      // A cap per person (and one for email no one signed in triggered, such
      // as website-form notifications) keeps a leaked token or a scripted
      // form from turning the business's domain into a spam relay. Sign-in
      // links have their own per-address limits.
      if (!email.template.startsWith("auth.")) {
        const key = input.user ? `email:user:${input.user.id}` : "email:system";
        if (!(await consumeRateLimit(db, key, input.user ? 100 : 300, 3600))) {
          if (input.user) throw tooManyRequests("You have sent a lot of email in the last hour. Try again later.");
          console.warn(`[email:${email.template}] not sent: the hourly limit for automatic emails was reached`);
          return { status: "failed" as const, id: "" };
        }
      }
      return sendEmail(input.env, db, email);
    },

    waitUntil(promise) {
      if (input.waitUntil) input.waitUntil(promise);
      else void promise.catch((error) => console.error("[waitUntil]", error));
    },
  };
  return ctx;
}

/** The request's ModuleContext. Available in every route after the core middleware. */
export function getContext(c: Context<AppEnv>): ModuleContext {
  const ctx = c.get("moduleContext");
  if (!ctx) throw new Error("Module context middleware is not installed");
  return ctx;
}

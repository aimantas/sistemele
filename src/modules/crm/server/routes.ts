import { Hono } from "hono";
import { z } from "zod";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { enforceRateLimit } from "@/worker/lib/rate-limit";
import { readJson, readQuery } from "@/worker/lib/validate";
import { verifyTurnstile } from "@/worker/lib/turnstile";
import { DEAL_STATUSES, inquirySchema, LEAD_FILTERS } from "../shared/schema";
import * as leads from "./leads";
import * as crm from "./service";
import * as stages from "./stages";

const id = z.string().max(80);

/** Mounted at /api/crm (signed-in users). Thin: every handler calls a service. */
export const crmApi = new Hono<AppEnv>()
  // Leads
  .get("/leads", async (c) => {
    const query = readQuery(c, z.object({ status: z.enum(LEAD_FILTERS).optional(), ownerId: id.optional(), source: z.string().max(40).optional(), q: z.string().max(100).optional(), due: z.enum(["1", "0"]).optional(), limit: z.coerce.number().optional(), offset: z.coerce.number().optional() }));
    return c.json(await leads.listLeads(getContext(c), { ...query, due: query.due === "1" }));
  })
  .post("/leads", async (c) => c.json(await leads.createLead(getContext(c), await c.req.json()), 201))
  .get("/leads/:id", async (c) => c.json(await leads.getLeadDetail(getContext(c), c.req.param("id"))))
  .patch("/leads/:id", async (c) => c.json(await leads.updateLead(getContext(c), c.req.param("id"), await c.req.json())))
  .post("/leads/:id/convert", async (c) => c.json(await leads.convertLead(getContext(c), c.req.param("id"), await c.req.json())))

  // Contacts
  .get("/contacts", async (c) => {
    const query = readQuery(c, z.object({ q: z.string().max(100).optional(), tag: z.string().max(40).optional(), limit: z.coerce.number().optional(), offset: z.coerce.number().optional() }));
    return c.json(await crm.listContacts(getContext(c), query));
  })
  .post("/contacts", async (c) => c.json(await crm.createContact(getContext(c), await c.req.json()), 201))
  .get("/contacts/:id", async (c) => c.json(await crm.getContactDetail(getContext(c), c.req.param("id"))))
  .patch("/contacts/:id", async (c) => c.json(await crm.updateContact(getContext(c), c.req.param("id"), await c.req.json())))
  .delete("/contacts/:id", async (c) => {
    await crm.archiveContact(getContext(c), c.req.param("id"));
    return c.json({ ok: true });
  })

  // Pipeline stages (changes need owner or admin)
  .get("/stages", async (c) => c.json({ items: await stages.listStages(getContext(c)) }))
  .post("/stages", async (c) => c.json(await stages.createStage(getContext(c), await c.req.json()), 201))
  .post("/stages/order", async (c) => c.json({ items: await stages.reorderStages(getContext(c), await c.req.json()) }))
  .patch("/stages/:id", async (c) => c.json(await stages.updateStage(getContext(c), c.req.param("id"), await c.req.json())))
  .delete("/stages/:id", async (c) => {
    const query = readQuery(c, z.object({ moveTo: z.string().max(60).optional() }));
    await stages.deleteStage(getContext(c), c.req.param("id"), query);
    return c.json({ ok: true });
  })

  // Deals
  .get("/deals", async (c) => {
    const query = readQuery(c, z.object({ stage: z.string().max(60).optional(), contactId: id.optional(), ownerId: id.optional(), status: z.enum(DEAL_STATUSES).optional() }));
    return c.json({ items: await crm.listDeals(getContext(c), query) });
  })
  .post("/deals", async (c) => c.json(await crm.createDeal(getContext(c), await c.req.json()), 201))
  .get("/deals/:id", async (c) => c.json(await crm.getDeal(getContext(c), c.req.param("id"))))
  .patch("/deals/:id", async (c) => c.json(await crm.updateDeal(getContext(c), c.req.param("id"), await c.req.json())))
  .post("/deals/:id/move", async (c) => c.json(await crm.moveDeal(getContext(c), c.req.param("id"), await c.req.json())))

  // Timeline
  .get("/activities", async (c) => {
    const query = readQuery(c, z.object({ contactId: id.optional(), dealId: id.optional(), leadId: id.optional(), open: z.enum(["1", "0"]).optional() }));
    return c.json({ items: await crm.listActivities(getContext(c), { contactId: query.contactId, dealId: query.dealId, leadId: query.leadId, openTasks: query.open === "1" }) });
  })
  .post("/activities", async (c) => c.json(await crm.addActivity(getContext(c), await c.req.json()), 201))
  .post("/activities/:id/complete", async (c) => {
    await crm.completeTask(getContext(c), c.req.param("id"));
    return c.json({ ok: true });
  });

/**
 * Mounted at /api/public/crm. The website form posts here as a normal HTML
 * form (303 redirect back to /contact) or as JSON (for agents and custom sites).
 * Each request becomes a lead.
 */
export const crmPublicApi = new Hono<AppEnv>().post("/inquiries", async (c) => {
  const ctx = getContext(c);
  const isForm = (c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded") || (c.req.header("content-type") ?? "").includes("multipart/form-data");
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  try {
    await enforceRateLimit(ctx.db, `inquiry:${ip}`, 5, 3600);
    const raw = isForm ? Object.fromEntries((await c.req.formData()).entries()) : await readJson(c, z.record(z.string(), z.unknown()));
    const input = inquirySchema.parse({ ...raw, turnstileToken: raw["cf-turnstile-response"] ?? raw.turnstileToken });
    await verifyTurnstile(c.env, input.turnstileToken, ip);
    const result = await leads.createInquiry(ctx, input);
    return isForm ? c.redirect("/contact?sent=1", 303) : c.json({ ok: true, reference: result.leadId }, 201);
  } catch (error) {
    if (!isForm) throw error;
    const code = error instanceof Error && "code" in error && error.code === "rate_limited" ? "rate_limited" : "invalid";
    return c.redirect(`/contact?error=${code}`, 303);
  }
});

import type { Page } from "@/shared/api";
import { newId } from "@/shared/ids";
import type { ModuleContext } from "@/modules/types.server";
import { renderEmail } from "@/worker/email/layout";
import { appOrigin } from "@/worker/env";
import { likePattern, type SqlValue } from "@/worker/lib/db";
import { AppError, conflict, notFound } from "@/worker/lib/errors";
import { assertTeamMember } from "@/worker/lib/team";
import {
  LEAD_STATUSES,
  leadConvertSchema,
  leadInputSchema,
  leadPatchSchema,
  OPEN_LEAD_STATUSES,
  type Contact,
  type Deal,
  type InquiryInput,
  type Lead,
  type LeadConvertInput,
  type LeadDetail,
  type LeadFilter,
  type LeadInput,
  type LeadPatch,
} from "../shared/schema";
import { createDeal, findContactByEmail, getContact, insertActivity, insertContact, LEAD_SELECT, listActivities } from "./service";

/**
 * Leads: people who asked or might buy, before there is a deal. Website
 * requests arrive here. Work a lead from new → contacted → qualified, then
 * convert it into a contact and a deal, or disqualify it with a reason.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const TODAY = "strftime('%Y-%m-%d', 'now')";
const OPEN_SQL = `l.status IN (${OPEN_LEAD_STATUSES.map((status) => `'${status}'`).join(", ")})`;
const statusLabel = (status: string) => LEAD_STATUSES.find((item) => item.id === status)?.label ?? status;

export interface LeadFilters {
  /** A status, "open" (default: new, contacted, qualified) or "all". */
  status?: LeadFilter;
  /** A user id, "me" or "none" (unassigned). */
  ownerId?: string;
  source?: string;
  /** Name, email, company or phone. */
  q?: string;
  /** Only open leads whose follow-up date is today or earlier. */
  due?: boolean;
  limit?: number;
  offset?: number;
}

export type LeadCounts = Record<LeadFilter | "due", number>;

/** Leads, newest first, with counts per status for the filter tabs. */
export async function listLeads(ctx: ModuleContext, options: LeadFilters = {}): Promise<Page<Lead> & { counts: LeadCounts }> {
  const user = ctx.requireRole("member");
  const status = options.status ?? "open";
  // Filters other than status; the counts respect them too.
  const base: string[] = [];
  const params: SqlValue[] = [];
  if (options.ownerId === "none") base.push("l.owner_id IS NULL");
  else if (options.ownerId) {
    base.push("l.owner_id = ?");
    params.push(options.ownerId === "me" ? user.id : options.ownerId);
  }
  if (options.source) {
    base.push("l.source = ?");
    params.push(options.source);
  }
  if (options.q?.trim()) {
    const pattern = likePattern(options.q.trim());
    base.push("(l.name LIKE ? ESCAPE '\\' OR l.email LIKE ? ESCAPE '\\' OR l.company LIKE ? ESCAPE '\\' OR l.phone LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern, pattern, pattern);
  }
  const where = [...base];
  const listParams = [...params];
  if (status === "open") where.push(OPEN_SQL);
  else if (status !== "all") {
    where.push("l.status = ?");
    listParams.push(status);
  }
  if (options.due) where.push(`${OPEN_SQL} AND l.follow_up_on IS NOT NULL AND l.follow_up_on <= ${TODAY}`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const baseSql = base.length ? `WHERE ${base.join(" AND ")}` : "";
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const [items, total, countRow] = await Promise.all([
    ctx.db.all<Lead>(`${LEAD_SELECT} ${whereSql} ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}`, listParams),
    ctx.db.value<number>(`SELECT COUNT(*) FROM leads l ${whereSql}`, listParams),
    ctx.db.first<Record<string, number>>(
      `SELECT COUNT(*) AS "all", COALESCE(SUM(${OPEN_SQL}), 0) AS open,
         ${LEAD_STATUSES.map((item) => `COALESCE(SUM(l.status = '${item.id}'), 0) AS ${item.id}`).join(", ")},
         COALESCE(SUM(${OPEN_SQL} AND l.follow_up_on IS NOT NULL AND l.follow_up_on <= ${TODAY}), 0) AS due
       FROM leads l ${baseSql}`,
      params,
    ),
  ]);
  return { items, total: total ?? 0, counts: (countRow ?? {}) as LeadCounts };
}

export async function getLead(ctx: ModuleContext, id: string): Promise<Lead> {
  ctx.requireRole("member");
  return getLeadUnchecked(ctx, id);
}

async function getLeadUnchecked(ctx: ModuleContext, id: string): Promise<Lead> {
  const lead = await ctx.db.first<Lead>(`${LEAD_SELECT} WHERE l.id = ?`, [id]);
  if (!lead) throw notFound("Lead");
  return lead;
}

/** The lead, its timeline and an existing contact with the same email (converting reuses it). */
export async function getLeadDetail(ctx: ModuleContext, id: string): Promise<LeadDetail> {
  const lead = await getLead(ctx, id);
  const [activities, matchingContact] = await Promise.all([listActivities(ctx, { leadId: id }), lead.contactId ? null : findContactByEmail(ctx, lead.email)]);
  return { lead, activities, matchingContact };
}

/** Adds a lead by hand (or by an agent). Without `ownerId` the creator owns it. */
export async function createLead(ctx: ModuleContext, raw: LeadInput): Promise<Lead> {
  const user = ctx.requireRole("member");
  const input = leadInputSchema.parse(raw);
  const ownerId = input.ownerId === undefined ? user.id : input.ownerId;
  await assertTeamMember(ctx.db, ownerId);
  return insertLead(ctx, { ...input, ownerId, followUpOn: input.followUpOn || null });
}

async function insertLead(ctx: ModuleContext, input: Required<Omit<LeadInput, "ownerId" | "followUpOn">> & { ownerId: string | null; followUpOn: string | null }): Promise<Lead> {
  const id = newId("ld");
  await ctx.db.run(
    "INSERT INTO leads (id, name, email, phone, company, message, source, value_cents, owner_id, follow_up_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.name, input.email.toLowerCase(), input.phone, input.company, input.message, input.source, input.valueCents, input.ownerId, input.followUpOn],
  );
  await ctx.audit({ action: "lead.created", entityType: "lead", entityId: id, summary: `New lead ${input.name}${input.company ? ` (${input.company})` : ""} from ${input.source}` });
  await ctx.emit("lead.created", { leadId: id, source: input.source });
  return getLeadUnchecked(ctx, id);
}

const LEAD_FIELD_COLUMNS: Record<string, string> = {
  name: "name", email: "email", phone: "phone", company: "company", message: "message", source: "source", valueCents: "value_cents",
  ownerId: "owner_id", followUpOn: "follow_up_on", status: "status", disqualifyReason: "disqualify_reason",
};

/**
 * Changes the given fields. Disqualifying needs a reason; moving back to an
 * open status clears it. Converted leads are read-only: change their contact
 * or deal instead.
 */
export async function updateLead(ctx: ModuleContext, id: string, raw: LeadPatch): Promise<Lead> {
  ctx.requireRole("member");
  const patch = leadPatchSchema.parse(raw);
  const lead = await getLead(ctx, id);
  if (lead.status === "converted") throw conflict("This lead is converted. Change its contact or deal instead.");
  if (patch.ownerId !== undefined) await assertTeamMember(ctx.db, patch.ownerId);

  const status = patch.status ?? lead.status;
  if (status === "disqualified") {
    const reason = patch.disqualifyReason ?? lead.disqualifyReason;
    if (!reason.trim()) throw new AppError(422, "validation_failed", "Say why the lead is disqualified.", { disqualifyReason: "Say why the lead is disqualified." });
  } else if (lead.disqualifyReason || patch.disqualifyReason) {
    patch.disqualifyReason = "";
  }

  const sets: string[] = [];
  const params: SqlValue[] = [];
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${LEAD_FIELD_COLUMNS[field]} = ?`);
    params.push(field === "followUpOn" ? (value as string | null) || null : field === "email" ? String(value).toLowerCase() : (value as SqlValue));
  }
  if (!sets.length) return lead;
  await ctx.db.run(`UPDATE leads SET ${sets.join(", ")}, updated_at = ${NOW} WHERE id = ?`, [...params, id]);

  if (patch.status && patch.status !== lead.status) {
    const reason = patch.status === "disqualified" ? ` Reason: ${patch.disqualifyReason ?? lead.disqualifyReason}` : "";
    await insertActivity(ctx, { contactId: null, dealId: null, leadId: id, kind: "system", body: `Status: ${statusLabel(lead.status)} → ${statusLabel(patch.status)}.${reason}` });
    await ctx.audit({ action: "lead.status_changed", entityType: "lead", entityId: id, summary: `${lead.name}: ${lead.status} → ${patch.status}` });
  } else {
    await ctx.audit({ action: "lead.updated", entityType: "lead", entityId: id, summary: `Updated ${Object.keys(patch).join(", ")} on ${lead.name}` });
  }
  return getLead(ctx, id);
}

/**
 * Turns a lead into a customer: reuses the contact given (or one with the same
 * email) or creates one, optionally opens a deal, moves the lead's timeline to
 * them and marks the lead converted.
 */
export async function convertLead(ctx: ModuleContext, id: string, raw: LeadConvertInput = {}): Promise<{ lead: Lead; contact: Contact; deal: Deal | null }> {
  ctx.requireRole("member");
  const input = leadConvertSchema.parse(raw);
  const lead = await getLead(ctx, id);
  if (lead.status === "converted") throw conflict("This lead is already converted.");
  if (lead.status === "disqualified") throw conflict("Reopen the lead before converting it.");

  const existing = input.contactId ? await getContact(ctx, input.contactId) : await findContactByEmail(ctx, lead.email);
  const contact = existing
    ? await getContact(ctx, existing.id)
    : await insertContact(
        ctx,
        {
          kind: lead.company ? "company" : "person",
          name: lead.company || lead.name,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.company,
          notes: lead.company ? `Contact person: ${lead.name}` : "",
        },
        lead.source,
      );

  const deal = input.createDeal
    ? await createDeal(ctx, {
        contactId: contact.id,
        title: input.dealTitle || lead.company || lead.name,
        valueCents: input.valueCents ?? lead.valueCents,
        stage: input.stage,
        ownerId: lead.ownerId ?? ctx.user?.id ?? null,
      })
    : null;

  const results = await ctx.db.batch([
    ctx.db.prepare(`UPDATE leads SET status = 'converted', contact_id = ?, deal_id = ?, converted_at = ${NOW}, updated_at = ${NOW} WHERE id = ? AND status NOT IN ('converted', 'disqualified')`, [contact.id, deal?.id ?? null, id]),
    ctx.db.prepare("UPDATE activities SET contact_id = COALESCE(contact_id, ?), deal_id = COALESCE(deal_id, ?) WHERE lead_id = ?", [contact.id, deal?.id ?? null, id]),
  ]);
  if (!results[0]?.meta.changes) throw conflict("This lead changed while converting. Reload it.");
  await insertActivity(ctx, { contactId: contact.id, dealId: deal?.id ?? null, leadId: id, kind: "system", body: `Converted from lead ${lead.name}${deal ? ` into deal ${deal.title}` : ""}.` });
  await ctx.audit({ action: "lead.converted", entityType: "lead", entityId: id, summary: `Converted ${lead.name} → contact ${contact.name}${deal ? `, deal ${deal.title}` : ""}` });
  await ctx.emit("lead.converted", { leadId: id, contactId: contact.id, dealId: deal?.id ?? null });
  return { lead: await getLead(ctx, id), contact, deal };
}

// Public inquiries

/**
 * A website visitor sends a request. It lands as a new lead, or as a note on
 * their open lead when they write again, and staff get an email.
 */
export async function createInquiry(ctx: ModuleContext, input: InquiryInput): Promise<{ leadId: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const open = await ctx.db.first<{ id: string }>(`SELECT l.id FROM leads l WHERE l.email = ? AND ${OPEN_SQL} ORDER BY l.created_at DESC LIMIT 1`, [email]);
  let leadId: string;
  if (open) {
    leadId = open.id;
    await insertActivity(ctx, { contactId: null, dealId: null, leadId, kind: "note", body: `New website request from ${input.name}${input.phone ? ` (${input.phone})` : ""}:\n\n${input.message}` });
    await ctx.audit({ action: "inquiry.received", entityType: "lead", entityId: leadId, summary: `Repeat website request from ${email}` });
  } else {
    leadId = (await insertLead(ctx, { name: input.name, email, phone: input.phone ?? "", company: input.company ?? "", message: input.message, source: "website", valueCents: 0, ownerId: null, followUpOn: null })).id;
  }

  const business = await ctx.business();
  if (business.email) {
    const link = `${appOrigin(ctx.env)}/app/crm/leads/${leadId}`;
    const content = renderEmail({
      preheader: `${input.name} sent a request through the website.`,
      heading: "New website request",
      paragraphs: [input.message],
      facts: [["Name", input.name], ["Email", email], ...(input.phone ? ([["Phone", input.phone]] as Array<[string, string]>) : []), ...(input.company ? ([["Company", input.company]] as Array<[string, string]>) : [])],
      action: { label: "Open the lead", url: link },
      footer: `${ctx.env.APP_NAME} · ${appOrigin(ctx.env)}`,
    });
    ctx.waitUntil(ctx.sendEmail({ to: business.email, replyTo: email, subject: `New request from ${input.name}`, template: "crm.inquiry_received", related: { type: "lead", id: leadId }, ...content }));
  }
  return { leadId, created: !open };
}

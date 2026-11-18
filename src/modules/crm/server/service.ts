import type { Page } from "@/shared/api";
import { newId } from "@/shared/ids";
import type { ModuleContext } from "@/modules/types.server";
import { likePattern, parseJsonColumn, type SqlValue } from "@/worker/lib/db";
import { notFound } from "@/worker/lib/errors";
import { assertTeamMember } from "@/worker/lib/team";
import {
  activityInputSchema,
  CONTACT_ACTIVITY_KINDS,
  contactInputSchema,
  contactPatchSchema,
  dealInputSchema,
  dealMoveSchema,
  dealPatchSchema,
  type Activity,
  type ActivityInput,
  type Contact,
  type ContactDetail,
  type ContactInput,
  type Deal,
  type DealInput,
  type DealMove,
  type DealPatch,
  type Lead,
} from "../shared/schema";
import { firstStageOfKind, requireStage } from "./stages";

/**
 * CRM services for contacts, deals and the activity timeline. Leads live in
 * ./leads.ts, pipeline stages in ./stages.ts. Routes, MCP tools, event
 * handlers and tests call these. Every function validates its input, so
 * callers may pass raw JSON.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const CONTACT_COLUMNS = `id, kind, name, email, phone, company_name AS companyName, company_code AS companyCode, vat_code AS vatCode,
  address, city, postal_code AS postalCode, country, website, tags, notes, source, created_at AS createdAt,
  updated_at AS updatedAt, archived_at AS archivedAt`;

const DEAL_SELECT = `SELECT d.id, d.contact_id AS contactId, c.name AS contactName, d.title, d.value_cents AS valueCents, d.stage,
  COALESCE(s.label, d.stage) AS stageLabel, COALESCE(s.kind, 'open') AS stageKind, COALESCE(s.probability_bps, 0) AS probabilityBps,
  d.position, d.expected_close_date AS expectedCloseDate, d.owner_id AS ownerId, COALESCE(NULLIF(u.name, ''), u.email) AS ownerName,
  d.lost_reason AS lostReason, d.created_at AS createdAt, d.updated_at AS updatedAt, d.closed_at AS closedAt
  FROM deals d JOIN contacts c ON c.id = d.contact_id LEFT JOIN pipeline_stages s ON s.id = d.stage LEFT JOIN users u ON u.id = d.owner_id`;

const ACTIVITY_SELECT = `SELECT a.id, a.contact_id AS contactId, a.deal_id AS dealId, a.lead_id AS leadId, a.kind, a.body, a.due_at AS dueAt,
  a.done_at AS doneAt, COALESCE(NULLIF(u.name, ''), u.email) AS authorName, c.name AS contactName, l.name AS leadName, a.created_at AS createdAt
  FROM activities a LEFT JOIN users u ON u.id = a.author_id LEFT JOIN contacts c ON c.id = a.contact_id LEFT JOIN leads l ON l.id = a.lead_id`;

/** Shared with ./leads.ts. */
export const LEAD_SELECT = `SELECT l.id, l.name, l.email, l.phone, l.company, l.message, l.source, l.status, l.value_cents AS valueCents,
  l.owner_id AS ownerId, COALESCE(NULLIF(u.name, ''), u.email) AS ownerName, l.follow_up_on AS followUpOn, l.disqualify_reason AS disqualifyReason,
  l.contact_id AS contactId, c.name AS contactName, l.deal_id AS dealId, d.title AS dealTitle, l.converted_at AS convertedAt,
  l.created_at AS createdAt, l.updated_at AS updatedAt
  FROM leads l LEFT JOIN users u ON u.id = l.owner_id LEFT JOIN contacts c ON c.id = l.contact_id LEFT JOIN deals d ON d.id = l.deal_id`;

type ContactRow = Omit<Contact, "tags"> & { tags: string };
const toContact = (row: ContactRow): Contact => ({ ...row, tags: parseJsonColumn<string[]>(row.tags, []) });

// Contacts

export async function listContacts(ctx: ModuleContext, options: { q?: string; tag?: string; limit?: number; offset?: number; includeArchived?: boolean } = {}): Promise<Page<Contact>> {
  ctx.requireRole("member");
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (!options.includeArchived) where.push("archived_at IS NULL");
  if (options.q?.trim()) {
    const pattern = likePattern(options.q.trim());
    where.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern, pattern, pattern);
  }
  if (options.tag) {
    where.push("EXISTS (SELECT 1 FROM json_each(contacts.tags) WHERE value = ?)");
    params.push(options.tag);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const [rows, total] = await Promise.all([
    ctx.db.all<ContactRow>(`SELECT ${CONTACT_COLUMNS} FROM contacts ${whereSql} ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
    ctx.db.value<number>(`SELECT COUNT(*) FROM contacts ${whereSql}`, params),
  ]);
  return { items: rows.map(toContact), total: total ?? 0 };
}

export async function getContact(ctx: ModuleContext, id: string): Promise<Contact> {
  ctx.requireRole("member");
  return getContactUnchecked(ctx, id);
}

export async function getContactDetail(ctx: ModuleContext, id: string): Promise<ContactDetail> {
  const contact = await getContact(ctx, id);
  const [deals, activities, leads] = await Promise.all([
    ctx.db.all<Deal>(`${DEAL_SELECT} WHERE d.contact_id = ? ORDER BY d.created_at DESC`, [id]),
    listActivities(ctx, { contactId: id }),
    ctx.db.all<Lead>(`${LEAD_SELECT} WHERE l.contact_id = ? ORDER BY l.created_at DESC`, [id]),
  ]);
  return { contact, deals, activities, leads };
}

export async function createContact(ctx: ModuleContext, raw: ContactInput): Promise<Contact> {
  ctx.requireRole("member");
  return insertContact(ctx, raw, "manual");
}

/** No role check: also used by lead conversion. `source` records where the contact came from. */
export async function insertContact(ctx: ModuleContext, raw: ContactInput, source: string): Promise<Contact> {
  const input = contactInputSchema.parse(raw);
  const id = newId("ct");
  await ctx.db.run(
    `INSERT INTO contacts (id, kind, name, email, phone, company_name, company_code, vat_code, address, city, postal_code, country, website, tags, notes, source, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.kind, input.name, input.email, input.phone, input.companyName, input.companyCode, input.vatCode, input.address, input.city, input.postalCode, input.country.toUpperCase(), input.website, JSON.stringify(input.tags), input.notes, source, ctx.user?.id ?? null],
  );
  await ctx.audit({ action: "contact.created", entityType: "contact", entityId: id, summary: `Created contact ${input.name}` });
  await ctx.emit("contact.created", { contactId: id, source });
  return getContactUnchecked(ctx, id);
}

async function getContactUnchecked(ctx: ModuleContext, id: string): Promise<Contact> {
  const row = await ctx.db.first<ContactRow>(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ?`, [id]);
  if (!row) throw notFound("Contact");
  return toContact(row);
}

/** The oldest active contact with this email, if any (case-insensitive). */
export async function findContactByEmail(ctx: ModuleContext, email: string): Promise<{ id: string; name: string } | null> {
  if (!email) return null;
  return ctx.db.first<{ id: string; name: string }>("SELECT id, name FROM contacts WHERE email = ? AND archived_at IS NULL ORDER BY created_at LIMIT 1", [email.trim().toLowerCase()]);
}

const CONTACT_FIELD_COLUMNS: Record<string, string> = {
  kind: "kind", name: "name", email: "email", phone: "phone", companyName: "company_name", companyCode: "company_code", vatCode: "vat_code",
  address: "address", city: "city", postalCode: "postal_code", country: "country", website: "website", tags: "tags", notes: "notes",
};

export async function updateContact(ctx: ModuleContext, id: string, raw: Partial<ContactInput>): Promise<Contact> {
  ctx.requireRole("member");
  const patch = contactPatchSchema.parse(raw);
  await getContact(ctx, id);
  const sets: string[] = [];
  const params: SqlValue[] = [];
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${CONTACT_FIELD_COLUMNS[field]} = ?`);
    params.push(field === "tags" ? JSON.stringify(value) : field === "country" ? String(value).toUpperCase() : (value as SqlValue));
  }
  if (sets.length) {
    await ctx.db.run(`UPDATE contacts SET ${sets.join(", ")}, updated_at = ${NOW} WHERE id = ?`, [...params, id]);
    await ctx.audit({ action: "contact.updated", entityType: "contact", entityId: id, summary: `Updated ${Object.keys(patch).join(", ")}` });
  }
  return getContact(ctx, id);
}

export async function archiveContact(ctx: ModuleContext, id: string): Promise<void> {
  ctx.requireRole("member");
  const contact = await getContact(ctx, id);
  await ctx.db.run(`UPDATE contacts SET archived_at = ${NOW}, updated_at = ${NOW} WHERE id = ?`, [id]);
  await ctx.audit({ action: "contact.archived", entityType: "contact", entityId: id, summary: `Archived ${contact.name}` });
}

// Deals

export interface DealFilters {
  stage?: string;
  contactId?: string;
  /** A user id, "me" or "none" (unassigned). */
  ownerId?: string;
  /** open, won or lost: the kind of the deal's stage. */
  status?: "open" | "won" | "lost";
}

export async function listDeals(ctx: ModuleContext, options: DealFilters = {}): Promise<Deal[]> {
  const user = ctx.requireRole("member");
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (options.stage) {
    where.push("d.stage = ?");
    params.push(options.stage);
  }
  if (options.contactId) {
    where.push("d.contact_id = ?");
    params.push(options.contactId);
  }
  if (options.ownerId === "none") where.push("d.owner_id IS NULL");
  else if (options.ownerId) {
    where.push("d.owner_id = ?");
    params.push(options.ownerId === "me" ? user.id : options.ownerId);
  }
  if (options.status) {
    where.push("COALESCE(s.kind, 'open') = ?");
    params.push(options.status);
  }
  return ctx.db.all<Deal>(`${DEAL_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY d.stage, d.position, d.created_at LIMIT 500`, params);
}

export async function getDeal(ctx: ModuleContext, id: string): Promise<Deal> {
  ctx.requireRole("member");
  const deal = await ctx.db.first<Deal>(`${DEAL_SELECT} WHERE d.id = ?`, [id]);
  if (!deal) throw notFound("Deal");
  return deal;
}

/** Opens a deal. Without `stage` it starts in the first open stage; without `ownerId` the creator owns it. */
export async function createDeal(ctx: ModuleContext, raw: DealInput): Promise<Deal> {
  const user = ctx.requireRole("member");
  const input = dealInputSchema.parse(raw);
  await getContact(ctx, input.contactId);
  const stage = input.stage ? await requireStage(ctx, input.stage) : await firstStageOfKind(ctx, "open");
  const ownerId = input.ownerId === undefined ? user.id : input.ownerId;
  await assertTeamMember(ctx.db, ownerId);
  const id = newId("dl");
  const position = (await ctx.db.value<number>("SELECT COALESCE(MAX(position), 0) + 1 FROM deals WHERE stage = ?", [stage.id])) ?? 1;
  await ctx.db.run(
    `INSERT INTO deals (id, contact_id, title, value_cents, stage, position, expected_close_date, owner_id, lost_reason, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'open' THEN NULL ELSE ${NOW} END)`,
    [id, input.contactId, input.title, input.valueCents, stage.id, position, input.expectedCloseDate || null, ownerId, stage.kind === "lost" ? input.lostReason : "", stage.kind],
  );
  await ctx.audit({ action: "deal.created", entityType: "deal", entityId: id, summary: `Created deal ${input.title} in ${stage.label}` });
  return getDeal(ctx, id);
}

const DEAL_FIELD_COLUMNS: Record<string, string> = { title: "title", valueCents: "value_cents", expectedCloseDate: "expected_close_date", ownerId: "owner_id", lostReason: "lost_reason" };

/** Changes the given fields. A different `stage` moves the deal to the end of that stage. */
export async function updateDeal(ctx: ModuleContext, id: string, raw: DealPatch): Promise<Deal> {
  const before = await getDeal(ctx, id);
  const patch = dealPatchSchema.parse(raw);
  if (patch.ownerId !== undefined) await assertTeamMember(ctx.db, patch.ownerId);
  const sets: string[] = [];
  const params: SqlValue[] = [];
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined || !DEAL_FIELD_COLUMNS[field]) continue;
    // A lost reason belongs to lost deals; moveDeal stores it when the stage changes.
    if (field === "lostReason" && before.stageKind !== "lost") continue;
    sets.push(`${DEAL_FIELD_COLUMNS[field]} = ?`);
    params.push(field === "expectedCloseDate" ? (value as string | null) || null : (value as SqlValue));
  }
  if (sets.length) {
    await ctx.db.run(`UPDATE deals SET ${sets.join(", ")}, updated_at = ${NOW} WHERE id = ?`, [...params, id]);
    await ctx.audit({ action: "deal.updated", entityType: "deal", entityId: id, summary: `Updated ${Object.keys(patch).join(", ")} on ${before.title}` });
  }
  if (patch.stage && patch.stage !== before.stage) {
    const last = (await ctx.db.value<number>("SELECT COALESCE(MAX(position), 0) + 1 FROM deals WHERE stage = ?", [patch.stage])) ?? 1;
    return moveDeal(ctx, id, { stage: patch.stage, position: last, lostReason: patch.lostReason });
  }
  return getDeal(ctx, id);
}

/**
 * Moves a deal to a stage and position (the pipeline board's drag and drop).
 * Won and lost stages close the deal; a lost move may carry `lostReason`.
 */
export async function moveDeal(ctx: ModuleContext, id: string, raw: DealMove): Promise<Deal> {
  const before = await getDeal(ctx, id);
  const { stage: stageId, position, lostReason } = dealMoveSchema.parse(raw);
  const stage = await requireStage(ctx, stageId);
  await ctx.db.run(
    `UPDATE deals SET stage = ?, position = ?, updated_at = ${NOW},
       closed_at = CASE WHEN ? = 'open' THEN NULL ELSE COALESCE(closed_at, ${NOW}) END,
       lost_reason = CASE WHEN ? = 'lost' THEN COALESCE(?, lost_reason) ELSE '' END
     WHERE id = ?`,
    [stage.id, position, stage.kind, stage.kind, lostReason ?? null, id],
  );
  if (stage.id !== before.stage) {
    await ctx.audit({ action: "deal.stage_changed", entityType: "deal", entityId: id, summary: `${before.title}: ${before.stageLabel} → ${stage.label}` });
    await ctx.emit("deal.stage_changed", { dealId: id, contactId: before.contactId, from: before.stage, to: stage.id });
  }
  return getDeal(ctx, id);
}

/** Open deals, their value and the value weighted by each stage's probability. */
export async function openPipeline(ctx: ModuleContext): Promise<{ count: number; valueCents: number; weightedCents: number }> {
  const row = await ctx.db.first<{ count: number; value: number; weighted: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(d.value_cents), 0) AS value, COALESCE(SUM(d.value_cents * s.probability_bps / 10000), 0) AS weighted
     FROM deals d JOIN pipeline_stages s ON s.id = d.stage WHERE s.kind = 'open'`,
  );
  return { count: row?.count ?? 0, valueCents: row?.value ?? 0, weightedCents: row?.weighted ?? 0 };
}

// Activities

export async function listActivities(ctx: ModuleContext, options: { contactId?: string; dealId?: string; leadId?: string; openTasks?: boolean; limit?: number } = {}): Promise<Activity[]> {
  ctx.requireRole("member");
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (options.contactId) {
    where.push("a.contact_id = ?");
    params.push(options.contactId);
  }
  if (options.dealId) {
    where.push("a.deal_id = ?");
    params.push(options.dealId);
  }
  if (options.leadId) {
    where.push("a.lead_id = ?");
    params.push(options.leadId);
  }
  if (options.openTasks) where.push("a.kind = 'task' AND a.done_at IS NULL");
  const order = options.openTasks ? "COALESCE(a.due_at, '9999') ASC, a.created_at ASC" : "a.created_at DESC";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 300);
  return ctx.db.all<Activity>(`${ACTIVITY_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ${limit}`, params);
}

/**
 * Adds a note, call, email, meeting or task to a lead, contact or deal.
 * A call, email or meeting logged on a new lead marks the lead contacted.
 */
export async function addActivity(ctx: ModuleContext, raw: ActivityInput): Promise<Activity> {
  ctx.requireRole("member");
  const input = activityInputSchema.parse(raw);
  let { contactId, dealId } = input;
  const lead = input.leadId ? await ctx.db.first<{ id: string; status: string; contact_id: string | null; deal_id: string | null }>("SELECT id, status, contact_id, deal_id FROM leads WHERE id = ?", [input.leadId]) : null;
  if (input.leadId && !lead) throw notFound("Lead");
  if (lead) {
    contactId ??= lead.contact_id;
    dealId ??= lead.deal_id;
  }
  if (dealId) contactId ??= (await getDeal(ctx, dealId)).contactId;
  if (contactId) await getContact(ctx, contactId);
  const activity = await insertActivity(ctx, { contactId, dealId, leadId: lead?.id ?? null, kind: input.kind, body: input.body, dueAt: input.dueAt || null });
  if (lead?.status === "new" && (CONTACT_ACTIVITY_KINDS as readonly string[]).includes(input.kind)) {
    await ctx.db.run(`UPDATE leads SET status = 'contacted', updated_at = ${NOW} WHERE id = ? AND status = 'new'`, [lead.id]);
    await insertActivity(ctx, { contactId: null, dealId: null, leadId: lead.id, kind: "system", body: "Status: New → Contacted." });
    await ctx.audit({ action: "lead.status_changed", entityType: "lead", entityId: lead.id, summary: `Marked contacted after a ${input.kind}` });
  }
  return activity;
}

/** No role check: callers check. Touches the contact and lead so lists sort by latest activity. */
export async function insertActivity(ctx: ModuleContext, activity: { contactId: string | null; dealId: string | null; leadId?: string | null; kind: Activity["kind"]; body: string; dueAt?: string | null }): Promise<Activity> {
  const id = newId("act");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO activities (id, contact_id, deal_id, lead_id, kind, body, due_at, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      id, activity.contactId, activity.dealId, activity.leadId ?? null, activity.kind, activity.body, activity.dueAt ?? null, activity.kind === "system" ? null : (ctx.user?.id ?? null),
    ]),
    ...(activity.contactId ? [ctx.db.prepare(`UPDATE contacts SET updated_at = ${NOW} WHERE id = ?`, [activity.contactId])] : []),
    ...(activity.leadId ? [ctx.db.prepare(`UPDATE leads SET updated_at = ${NOW} WHERE id = ?`, [activity.leadId])] : []),
  ]);
  const row = await ctx.db.first<Activity>(`${ACTIVITY_SELECT} WHERE a.id = ?`, [id]);
  if (!row) throw notFound("Activity");
  return row;
}

/** System timeline entries written by other modules' events. */
export async function addSystemActivity(ctx: ModuleContext, contactId: string, dealId: string | null, body: string): Promise<void> {
  await insertActivity(ctx, { contactId, dealId, kind: "system", body });
}

export async function completeTask(ctx: ModuleContext, id: string): Promise<void> {
  ctx.requireRole("member");
  const result = await ctx.db.run(`UPDATE activities SET done_at = ${NOW} WHERE id = ? AND kind = 'task' AND done_at IS NULL`, [id]);
  if (!result.meta.changes) throw notFound("Open task");
}

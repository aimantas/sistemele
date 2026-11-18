import type { Page } from "@/shared/api";
import { newId } from "@/shared/ids";
import type { ModuleContext } from "@/modules/types.server";
import { renderEmail } from "@/worker/email/layout";
import { appOrigin } from "@/worker/env";
import { likePattern, parseJsonColumn, type SqlValue } from "@/worker/lib/db";
import { notFound } from "@/worker/lib/errors";
import {
  activityInputSchema,
  contactInputSchema,
  contactPatchSchema,
  dealInputSchema,
  dealMoveSchema,
  dealPatchSchema,
  OPEN_STAGES,
  type Activity,
  type ActivityInput,
  type Contact,
  type ContactDetail,
  type ContactInput,
  type Deal,
  type DealInput,
  type InquiryInput,
} from "../shared/schema";

/**
 * CRM services. Routes, MCP tools, event handlers and tests call these.
 * Every function validates its input, so callers may pass raw JSON.
 */

const CONTACT_COLUMNS = `id, kind, name, email, phone, company_name AS companyName, company_code AS companyCode, vat_code AS vatCode,
  address, city, postal_code AS postalCode, country, website, tags, notes, source, created_at AS createdAt,
  updated_at AS updatedAt, archived_at AS archivedAt`;

const DEAL_COLUMNS = `d.id, d.contact_id AS contactId, c.name AS contactName, d.title, d.value_cents AS valueCents, d.stage, d.position,
  d.expected_close_date AS expectedCloseDate, d.created_at AS createdAt, d.updated_at AS updatedAt, d.closed_at AS closedAt`;

const ACTIVITY_COLUMNS = `a.id, a.contact_id AS contactId, a.deal_id AS dealId, a.kind, a.body, a.due_at AS dueAt, a.done_at AS doneAt,
  u.name AS authorName, c.name AS contactName, a.created_at AS createdAt`;

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
  const row = await ctx.db.first<ContactRow>(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ?`, [id]);
  if (!row) throw notFound("Contact");
  return toContact(row);
}

export async function getContactDetail(ctx: ModuleContext, id: string): Promise<ContactDetail> {
  const contact = await getContact(ctx, id);
  const [deals, activities] = await Promise.all([
    ctx.db.all<Deal>(`SELECT ${DEAL_COLUMNS} FROM deals d JOIN contacts c ON c.id = d.contact_id WHERE d.contact_id = ? ORDER BY d.created_at DESC`, [id]),
    listActivities(ctx, { contactId: id }),
  ]);
  return { contact, deals, activities };
}

export async function createContact(ctx: ModuleContext, raw: ContactInput): Promise<Contact> {
  ctx.requireRole("member");
  return insertContact(ctx, raw, "manual");
}

/** No role check: also used by the public inquiry form. */
async function insertContact(ctx: ModuleContext, raw: ContactInput, source: string): Promise<Contact> {
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
    await ctx.db.run(`UPDATE contacts SET ${sets.join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`, [...params, id]);
    await ctx.audit({ action: "contact.updated", entityType: "contact", entityId: id, summary: `Updated ${Object.keys(patch).join(", ")}` });
  }
  return getContact(ctx, id);
}

export async function archiveContact(ctx: ModuleContext, id: string): Promise<void> {
  ctx.requireRole("member");
  const contact = await getContact(ctx, id);
  await ctx.db.run("UPDATE contacts SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [id]);
  await ctx.audit({ action: "contact.archived", entityType: "contact", entityId: id, summary: `Archived ${contact.name}` });
}

// Deals

export async function listDeals(ctx: ModuleContext, options: { stage?: string; contactId?: string } = {}): Promise<Deal[]> {
  ctx.requireRole("member");
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
  return ctx.db.all<Deal>(
    `SELECT ${DEAL_COLUMNS} FROM deals d JOIN contacts c ON c.id = d.contact_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY d.stage, d.position, d.created_at LIMIT 500`,
    params,
  );
}

export async function getDeal(ctx: ModuleContext, id: string): Promise<Deal> {
  ctx.requireRole("member");
  const deal = await ctx.db.first<Deal>(`SELECT ${DEAL_COLUMNS} FROM deals d JOIN contacts c ON c.id = d.contact_id WHERE d.id = ?`, [id]);
  if (!deal) throw notFound("Deal");
  return deal;
}

export async function createDeal(ctx: ModuleContext, raw: DealInput): Promise<Deal> {
  ctx.requireRole("member");
  const input = dealInputSchema.parse(raw);
  await getContact(ctx, input.contactId);
  const id = newId("dl");
  const position = (await ctx.db.value<number>("SELECT COALESCE(MAX(position), 0) + 1 FROM deals WHERE stage = ?", [input.stage])) ?? 1;
  await ctx.db.run(
    `INSERT INTO deals (id, contact_id, title, value_cents, stage, position, expected_close_date, owner_id, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN ('won', 'lost') THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END)`,
    [id, input.contactId, input.title, input.valueCents, input.stage, position, input.expectedCloseDate || null, ctx.user?.id ?? null, input.stage],
  );
  await ctx.audit({ action: "deal.created", entityType: "deal", entityId: id, summary: `Created deal ${input.title}` });
  return getDeal(ctx, id);
}

export async function updateDeal(ctx: ModuleContext, id: string, raw: Partial<DealInput>): Promise<Deal> {
  const before = await getDeal(ctx, id);
  const patch = dealPatchSchema.parse(raw);
  await ctx.db.run(
    `UPDATE deals SET title = COALESCE(?, title), value_cents = COALESCE(?, value_cents), expected_close_date = CASE WHEN ? THEN ? ELSE expected_close_date END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    [patch.title ?? null, patch.valueCents ?? null, patch.expectedCloseDate !== undefined ? 1 : 0, patch.expectedCloseDate || null, id],
  );
  if (patch.stage && patch.stage !== before.stage) return moveDeal(ctx, id, { stage: patch.stage, position: Date.now() });
  return getDeal(ctx, id);
}

/** Moves a deal to a stage and position (the pipeline board's drag and drop). */
export async function moveDeal(ctx: ModuleContext, id: string, raw: { stage: string; position: number }): Promise<Deal> {
  const before = await getDeal(ctx, id);
  const { stage, position } = dealMoveSchema.parse(raw);
  await ctx.db.run(
    `UPDATE deals SET stage = ?, position = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       closed_at = CASE WHEN ? IN ('won', 'lost') THEN COALESCE(closed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ELSE NULL END
     WHERE id = ?`,
    [stage, position, stage, id],
  );
  if (stage !== before.stage) {
    await ctx.audit({ action: "deal.stage_changed", entityType: "deal", entityId: id, summary: `${before.title}: ${before.stage} → ${stage}` });
    await ctx.emit("deal.stage_changed", { dealId: id, contactId: before.contactId, from: before.stage, to: stage });
  }
  return getDeal(ctx, id);
}

// Activities

export async function listActivities(ctx: ModuleContext, options: { contactId?: string; dealId?: string; openTasks?: boolean; limit?: number } = {}): Promise<Activity[]> {
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
  if (options.openTasks) where.push("a.kind = 'task' AND a.done_at IS NULL");
  const order = options.openTasks ? "COALESCE(a.due_at, '9999') ASC, a.created_at ASC" : "a.created_at DESC";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 300);
  return ctx.db.all<Activity>(
    `SELECT ${ACTIVITY_COLUMNS} FROM activities a
     LEFT JOIN users u ON u.id = a.author_id LEFT JOIN contacts c ON c.id = a.contact_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ${limit}`,
    params,
  );
}

export async function addActivity(ctx: ModuleContext, raw: ActivityInput): Promise<Activity> {
  ctx.requireRole("member");
  const input = activityInputSchema.parse(raw);
  let contactId = input.contactId;
  if (input.dealId) contactId ??= (await getDeal(ctx, input.dealId)).contactId;
  if (contactId) await getContact(ctx, contactId);
  return insertActivity(ctx, { contactId, dealId: input.dealId, kind: input.kind, body: input.body, dueAt: input.dueAt || null });
}

async function insertActivity(ctx: ModuleContext, activity: { contactId: string | null; dealId: string | null; kind: Activity["kind"]; body: string; dueAt?: string | null }): Promise<Activity> {
  const id = newId("act");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO activities (id, contact_id, deal_id, kind, body, due_at, author_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      id, activity.contactId, activity.dealId, activity.kind, activity.body, activity.dueAt ?? null, activity.kind === "system" ? null : (ctx.user?.id ?? null),
    ]),
    ...(activity.contactId ? [ctx.db.prepare("UPDATE contacts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [activity.contactId])] : []),
  ]);
  const row = await ctx.db.first<Activity>(`SELECT ${ACTIVITY_COLUMNS} FROM activities a LEFT JOIN users u ON u.id = a.author_id LEFT JOIN contacts c ON c.id = a.contact_id WHERE a.id = ?`, [id]);
  if (!row) throw notFound("Activity");
  return row;
}

/** System timeline entries written by other modules' events. */
export async function addSystemActivity(ctx: ModuleContext, contactId: string, dealId: string | null, body: string): Promise<void> {
  await insertActivity(ctx, { contactId, dealId, kind: "system", body });
}

export async function completeTask(ctx: ModuleContext, id: string): Promise<void> {
  ctx.requireRole("member");
  const result = await ctx.db.run("UPDATE activities SET done_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND kind = 'task' AND done_at IS NULL", [id]);
  if (!result.meta.changes) throw notFound("Open task");
}

// Public inquiries

/**
 * A website visitor asks for a quote. Reuses the contact with the same email,
 * opens a lead deal, stores the message on the timeline and notifies staff.
 */
export async function createInquiry(ctx: ModuleContext, input: InquiryInput): Promise<{ contactId: string; dealId: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await ctx.db.first<{ id: string }>("SELECT id FROM contacts WHERE email = ? AND archived_at IS NULL ORDER BY created_at LIMIT 1", [email]);
  const contactId =
    existing?.id ??
    (await insertContact(ctx, { kind: input.company ? "company" : "person", name: input.company || input.name, email, phone: input.phone ?? "", companyName: input.company ?? "", notes: input.company ? `Contact person: ${input.name}` : "", tags: ["website"] }, "website")).id;

  const dealId = newId("dl");
  const title = `Website request: ${input.message.slice(0, 60)}${input.message.length > 60 ? "…" : ""}`;
  const position = (await ctx.db.value<number>("SELECT COALESCE(MAX(position), 0) + 1 FROM deals WHERE stage = 'lead'")) ?? 1;
  await ctx.db.run("INSERT INTO deals (id, contact_id, title, stage, position) VALUES (?, ?, ?, 'lead', ?)", [dealId, contactId, title, position]);
  await insertActivity(ctx, { contactId, dealId, kind: "note", body: `Website request from ${input.name}${input.phone ? ` (${input.phone})` : ""}:\n\n${input.message}` });
  await ctx.audit({ action: "inquiry.received", entityType: "deal", entityId: dealId, summary: `Website request from ${email}` });

  const business = await ctx.business();
  if (business.email) {
    const link = `${appOrigin(ctx.env)}/app/crm/contacts/${contactId}`;
    const content = renderEmail({
      preheader: `${input.name} sent a request through the website.`,
      heading: "New website request",
      paragraphs: [input.message],
      facts: [["Name", input.name], ["Email", email], ...(input.phone ? ([["Phone", input.phone]] as Array<[string, string]>) : []), ...(input.company ? ([["Company", input.company]] as Array<[string, string]>) : [])],
      action: { label: "Open in CRM", url: link },
      footer: `${ctx.env.APP_NAME} · ${appOrigin(ctx.env)}`,
    });
    ctx.waitUntil(ctx.sendEmail({ to: business.email, replyTo: email, subject: `New request from ${input.name}`, template: "crm.inquiry_received", related: { type: "deal", id: dealId }, ...content }));
  }
  return { contactId, dealId };
}

export async function openPipeline(ctx: ModuleContext): Promise<{ count: number; valueCents: number }> {
  const row = await ctx.db.first<{ count: number; value: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(value_cents), 0) AS value FROM deals WHERE stage IN (${OPEN_STAGES.map(() => "?").join(", ")})`,
    OPEN_STAGES,
  );
  return { count: row?.count ?? 0, valueCents: row?.value ?? 0 };
}

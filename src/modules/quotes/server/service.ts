import type { Page } from "@/shared/api";
import type { BusinessProfile } from "@/shared/business";
import { addDays, formatDate, todayDate } from "@/shared/dates";
import { newId } from "@/shared/ids";
import { priceLines, type Line, type PartySnapshot } from "@/shared/lines";
import { documentTotals, formatMoney } from "@/shared/money";
import type { ModuleContext } from "@/modules/types.server";
import { renderEmail } from "@/worker/email/layout";
import { appOrigin } from "@/worker/env";
import { randomToken, sha256Hex } from "@/worker/lib/crypto";
import { likePattern, type SqlValue } from "@/worker/lib/db";
import { AppError, conflict, notFound } from "@/worker/lib/errors";
import { nextDocumentNumber } from "@/worker/lib/sequences";
import {
  effectiveQuoteStatus,
  QUOTE_VALIDITY_DAYS,
  quoteInputSchema,
  quoteMarkSchema,
  quotePatchSchema,
  quoteSendSchema,
  quoteStatusLabel,
  type Quote,
  type QuoteDetail,
  type QuoteInput,
  type QuoteLine,
  type QuoteListStatus,
  type QuoteMarkInput,
  type QuotePatch,
  type QuoteSendInput,
  type QuoteSendResult,
} from "../shared/schema";

/**
 * Quote services. REST routes, MCP tools, the public quote page and tests call
 * these. Every function validates its input, so callers may pass raw JSON.
 * Totals are always recalculated here from the lines.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const QUOTE_COLUMNS = `q.id, q.number, q.contact_id AS contactId, c.name AS contactName, q.deal_id AS dealId, d.title AS dealTitle,
  q.status, q.issue_date AS issueDate, q.valid_until AS validUntil, q.currency, q.subtotal_cents AS subtotalCents,
  q.vat_cents AS vatCents, q.total_cents AS totalCents, q.notes, q.terms, q.sent_at AS sentAt, q.responded_at AS respondedAt,
  q.created_at AS createdAt, q.updated_at AS updatedAt`;
const QUOTE_FROM = "quotes q JOIN contacts c ON c.id = q.contact_id LEFT JOIN deals d ON d.id = q.deal_id";

const LINE_COLUMNS = `id, position, product_id AS productId, description, quantity, unit, unit_price_cents AS unitPriceCents,
  vat_rate_bps AS vatRateBps, discount_bps AS discountBps, subtotal_cents AS subtotalCents`;

interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyCode: string;
  vatCode: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  archivedAt: string | null;
}

const invalid = (issues: Record<string, string>, message = "Check the highlighted fields.") => new AppError(422, "validation_failed", message, issues);

export function today(ctx: ModuleContext): string {
  return todayDate(ctx.timezone);
}

const withStatus = (row: Quote, day: string): Quote => ({ ...row, status: effectiveQuoteStatus(row.status, row.validUntil, day) });

// Reads

export interface ListQuotesOptions {
  status?: QuoteListStatus;
  contactId?: string;
  dealId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listQuotes(ctx: ModuleContext, options: ListQuotesOptions = {}): Promise<Page<Quote>> {
  ctx.requireRole("member");
  const day = today(ctx);
  const where: string[] = [];
  const params: SqlValue[] = [];
  switch (options.status) {
    case undefined:
      break;
    case "awaiting":
      where.push("q.status IN ('sent', 'expired')");
      break;
    case "expired":
      where.push("(q.status = 'expired' OR (q.status = 'sent' AND q.valid_until < ?))");
      params.push(day);
      break;
    case "sent":
      where.push("q.status = 'sent' AND q.valid_until >= ?");
      params.push(day);
      break;
    default:
      where.push("q.status = ?");
      params.push(options.status);
  }
  if (options.contactId) {
    where.push("q.contact_id = ?");
    params.push(options.contactId);
  }
  if (options.dealId) {
    where.push("q.deal_id = ?");
    params.push(options.dealId);
  }
  if (options.q?.trim()) {
    const pattern = likePattern(options.q.trim());
    where.push("(q.number LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order = options.status === "awaiting" ? "q.sent_at ASC, q.number ASC" : "q.created_at DESC, q.number DESC";
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 200);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const [rows, total] = await Promise.all([
    ctx.db.all<Quote>(`SELECT ${QUOTE_COLUMNS} FROM ${QUOTE_FROM} ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    ctx.db.value<number>(`SELECT COUNT(*) FROM ${QUOTE_FROM} ${whereSql}`, params),
  ]);
  return { items: rows.map((row) => withStatus(row, day)), total: total ?? 0 };
}

export async function getQuote(ctx: ModuleContext, id: string): Promise<QuoteDetail> {
  ctx.requireRole("member");
  return loadDetail(ctx, id);
}

/** No role check: the public quote page loads through a verified token. */
async function loadDetail(ctx: ModuleContext, id: string): Promise<QuoteDetail> {
  const row = await ctx.db.first<Quote>(`SELECT ${QUOTE_COLUMNS} FROM ${QUOTE_FROM} WHERE q.id = ?`, [id]);
  if (!row) throw notFound("Quote");
  const [lines, contact, invoiceId, business] = await Promise.all([
    ctx.db.all<QuoteLine>(`SELECT ${LINE_COLUMNS} FROM quote_lines WHERE quote_id = ? ORDER BY position`, [id]),
    readContact(ctx, row.contactId),
    ctx.db.value<string>("SELECT id FROM invoices WHERE quote_id = ? AND status <> 'void' ORDER BY created_at DESC LIMIT 1", [id]),
    ctx.business(),
  ]);
  if (!contact) throw notFound("Contact");
  const { vatGroups } = documentTotals(lines);
  return {
    ...withStatus(row, today(ctx)),
    lines,
    vatGroups,
    contact: { id: contact.id, name: contact.name, email: contact.email, archived: Boolean(contact.archivedAt) },
    seller: sellerParty(business),
    buyer: buyerParty(contact),
    invoiceId: invoiceId ?? null,
  };
}

async function readContact(ctx: ModuleContext, id: string): Promise<ContactRow | null> {
  return ctx.db.first<ContactRow>(
    `SELECT id, name, email, phone, company_code AS companyCode, vat_code AS vatCode, address, city, postal_code AS postalCode, country, archived_at AS archivedAt
     FROM contacts WHERE id = ?`,
    [id],
  );
}

export function sellerParty(business: BusinessProfile): PartySnapshot {
  return {
    name: business.legalName || business.name,
    companyCode: business.companyCode,
    vatCode: business.vatCode,
    address: business.address,
    email: business.email,
    phone: business.phone,
  };
}

function buyerParty(contact: ContactRow): PartySnapshot {
  const cityLine = [contact.postalCode, contact.city].filter(Boolean).join(" ");
  return {
    name: contact.name,
    companyCode: contact.companyCode,
    vatCode: contact.vatCode,
    address: [contact.address, cityLine, contact.country].filter(Boolean).join(", "),
    email: contact.email,
    phone: contact.phone,
  };
}

async function requireStored(ctx: ModuleContext, id: string): Promise<{ id: string; number: string; status: string; validUntil: string; contactId: string; dealId: string | null; totalCents: number }> {
  const row = await ctx.db.first<{ id: string; number: string; status: string; validUntil: string; contactId: string; dealId: string | null; totalCents: number }>(
    "SELECT id, number, status, valid_until AS validUntil, contact_id AS contactId, deal_id AS dealId, total_cents AS totalCents FROM quotes WHERE id = ?",
    [id],
  );
  if (!row) throw notFound("Quote");
  return row;
}

// Validation helpers shared by create and update

async function checkParties(ctx: ModuleContext, contactId: string, dealId: string | null): Promise<void> {
  const contact = await readContact(ctx, contactId);
  if (!contact || contact.archivedAt) throw invalid({ contactId: contact ? "This contact is archived. Choose another one." : "Choose a contact." });
  if (dealId) {
    const deal = await ctx.db.first<{ contactId: string }>("SELECT contact_id AS contactId FROM deals WHERE id = ?", [dealId]);
    if (!deal) throw invalid({ dealId: "This deal does not exist." });
    if (deal.contactId !== contactId) throw invalid({ dealId: "This deal belongs to another contact." });
  }
}

function checkDates(issueDate: string, validUntil: string): void {
  if (validUntil < issueDate) throw invalid({ validUntil: "Valid until must be on or after the issue date." });
}

function withDefaultVat(lines: Array<Omit<Line, "vatRateBps"> & { vatRateBps?: number }>, vatRateBps: number): Line[] {
  return lines.map((line) => ({ ...line, vatRateBps: line.vatRateBps ?? vatRateBps }));
}

function lineStatements(ctx: ModuleContext, quoteId: string, lines: Line[]): D1PreparedStatement[] {
  const { lines: priced } = priceLines(lines);
  return priced.map((line) =>
    ctx.db.prepare(
      `INSERT INTO quote_lines (id, quote_id, position, product_id, description, quantity, unit, unit_price_cents, vat_rate_bps, discount_bps, subtotal_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId("ql"), quoteId, line.position, line.productId, line.description, line.quantity, line.unit, line.unitPriceCents, line.vatRateBps, line.discountBps, line.subtotalCents],
    ),
  );
}

// Writes

export async function createQuote(ctx: ModuleContext, raw: QuoteInput): Promise<QuoteDetail> {
  const user = ctx.requireRole("member");
  const input = quoteInputSchema.parse(raw);
  const business = await ctx.business();
  const dealId = input.dealId || null;
  await checkParties(ctx, input.contactId, dealId);
  const issueDate = input.issueDate ?? today(ctx);
  const validUntil = input.validUntil ?? addDays(issueDate, QUOTE_VALIDITY_DAYS);
  checkDates(issueDate, validUntil);

  const lines = withDefaultVat(input.lines, business.defaultVatRateBps);
  const { totals } = priceLines(lines);
  const number = await nextDocumentNumber(ctx.db, business.quotePrefix, Number(issueDate.slice(0, 4)));
  const id = newId("qt");
  await ctx.db.batch([
    ctx.db.prepare(
      `INSERT INTO quotes (id, number, contact_id, deal_id, status, issue_date, valid_until, currency, subtotal_cents, vat_cents, total_cents, notes, terms, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, number, input.contactId, dealId, issueDate, validUntil, business.currency, totals.subtotalCents, totals.vatCents, totals.totalCents, input.notes, input.terms, user.id],
    ),
    ...lineStatements(ctx, id, lines),
  ]);
  await ctx.audit({ action: "quote.created", entityType: "quote", entityId: id, summary: `Created quote ${number}` });
  return loadDetail(ctx, id);
}

export async function updateQuote(ctx: ModuleContext, id: string, raw: QuotePatch): Promise<QuoteDetail> {
  ctx.requireRole("member");
  const patch = quotePatchSchema.parse(raw);
  const before = await ctx.db.first<{ number: string; status: string; contactId: string; dealId: string | null; issueDate: string; validUntil: string }>(
    "SELECT number, status, contact_id AS contactId, deal_id AS dealId, issue_date AS issueDate, valid_until AS validUntil FROM quotes WHERE id = ?",
    [id],
  );
  if (!before) throw notFound("Quote");
  if (before.status !== "draft") throw conflict("Only draft quotes can be edited. Revise the quote to return it to draft first.");

  const contactId = patch.contactId ?? before.contactId;
  // A new contact without an explicit deal drops the old contact's deal.
  const dealId = patch.dealId !== undefined ? patch.dealId || null : contactId === before.contactId ? before.dealId : null;
  if (patch.contactId !== undefined || patch.dealId) await checkParties(ctx, contactId, dealId);
  const issueDate = patch.issueDate ?? before.issueDate;
  const validUntil = patch.validUntil ?? before.validUntil;
  checkDates(issueDate, validUntil);

  const statements: D1PreparedStatement[] = [];
  let totalsSql = "";
  const totalsParams: SqlValue[] = [];
  if (patch.lines) {
    const business = await ctx.business();
    const lines = withDefaultVat(patch.lines, business.defaultVatRateBps);
    const { totals } = priceLines(lines);
    totalsSql = ", subtotal_cents = ?, vat_cents = ?, total_cents = ?";
    totalsParams.push(totals.subtotalCents, totals.vatCents, totals.totalCents);
    statements.push(ctx.db.prepare("DELETE FROM quote_lines WHERE quote_id = ?", [id]), ...lineStatements(ctx, id, lines));
  }
  statements.unshift(
    ctx.db.prepare(
      `UPDATE quotes SET contact_id = ?, deal_id = ?, issue_date = ?, valid_until = ?, notes = COALESCE(?, notes), terms = COALESCE(?, terms)${totalsSql},
         updated_at = ${NOW} WHERE id = ? AND status = 'draft'`,
      [contactId, dealId, issueDate, validUntil, patch.notes ?? null, patch.terms ?? null, ...totalsParams, id],
    ),
  );
  const [update] = await ctx.db.batch(statements);
  if (!update?.meta.changes) throw conflict("Only draft quotes can be edited. Revise the quote to return it to draft first.");
  await ctx.audit({ action: "quote.updated", entityType: "quote", entityId: id, summary: `Updated ${before.number}: ${Object.keys(patch).join(", ")}` });
  return loadDetail(ctx, id);
}

export async function deleteQuote(ctx: ModuleContext, id: string): Promise<void> {
  ctx.requireRole("member");
  const quote = await requireStored(ctx, id);
  if (quote.status !== "draft") throw conflict("Only draft quotes can be deleted. Mark it declined or leave it to expire instead.");
  const [, removed] = await ctx.db.batch([
    ctx.db.prepare("DELETE FROM quote_lines WHERE quote_id = ? AND EXISTS (SELECT 1 FROM quotes WHERE id = ? AND status = 'draft')", [id, id]),
    ctx.db.prepare("DELETE FROM quotes WHERE id = ? AND status = 'draft'", [id]),
  ]);
  if (!removed?.meta.changes) throw conflict("Only draft quotes can be deleted.");
  await ctx.audit({ action: "quote.deleted", entityType: "quote", entityId: id, summary: `Deleted draft ${quote.number}` });
}

/**
 * Emails the customer a private link and marks the quote sent. Sending a sent
 * quote again makes a new link; the previous one stops working.
 */
export async function sendQuote(ctx: ModuleContext, id: string, raw: QuoteSendInput = {}): Promise<QuoteSendResult> {
  ctx.requireRole("member");
  const { message } = quoteSendSchema.parse(raw);
  const quote = await loadDetail(ctx, id);
  if (quote.status === "accepted" || quote.status === "declined") throw conflict(`This quote is already ${quote.status}. Duplicate it to make a new offer.`);
  if (quote.validUntil < today(ctx)) {
    const fix = quote.status === "draft" ? "Edit the valid-until date" : "Revise the quote and set a new valid-until date";
    throw invalid({ validUntil: "This date has passed." }, `This quote expired on ${quote.validUntil}. ${fix}, then send it.`);
  }
  if (!quote.contact.email) throw new AppError(422, "contact_email_missing", `${quote.contact.name} has no email address. Add one in CRM, then send the quote.`);

  const token = randomToken();
  const result = await ctx.db.run(
    `UPDATE quotes SET status = 'sent', public_token_hash = ?, sent_at = ${NOW}, responded_at = NULL, updated_at = ${NOW} WHERE id = ? AND status IN ('draft', 'sent')`,
    [await sha256Hex(token), id],
  );
  if (!result.meta.changes) throw conflict("This quote changed while sending. Reload and try again.");

  const business = await ctx.business();
  const publicUrl = `${appOrigin(ctx.env)}/q/${token}`;
  const total = formatMoney(quote.totalCents, quote.currency, ctx.locale);
  const intro = message
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const content = renderEmail({
    preheader: `Quote ${quote.number}: ${total}, valid until ${formatDate(quote.validUntil, ctx.locale)}.`,
    heading: `Quote ${quote.number} from ${business.name}`,
    paragraphs: [...intro, "Open the quote to review every line, then accept or decline it online."],
    facts: [
      ["Quote", quote.number],
      ["Total", total],
      ["Valid until", formatDate(quote.validUntil, ctx.locale)],
    ],
    action: { label: "View quote", url: publicUrl },
    footer: [business.legalName || business.name, business.email, business.phone].filter(Boolean).join(" · "),
  });
  const email = await ctx.sendEmail({
    to: quote.contact.email,
    replyTo: business.email || undefined,
    subject: `Quote ${quote.number} from ${business.name}`,
    template: "quotes.sent",
    related: { type: "quote", id },
    ...content,
  });

  await ctx.audit({ action: "quote.sent", entityType: "quote", entityId: id, summary: `Sent ${quote.number} to ${quote.contact.email}`, data: { emailStatus: email.status } });
  await ctx.emit("quote.sent", { quoteId: id, contactId: quote.contactId, dealId: quote.dealId, number: quote.number });
  return { quote: await loadDetail(ctx, id), publicUrl, emailStatus: email.status };
}

/** Back to draft for changes. The customer link stops working. */
export async function reviseQuote(ctx: ModuleContext, id: string): Promise<QuoteDetail> {
  ctx.requireRole("member");
  const quote = await requireStored(ctx, id);
  if (quote.status === "draft") throw conflict("This quote is already a draft.");
  if (quote.status === "accepted" || quote.status === "declined") throw conflict(`This quote is ${quote.status} and locked. Duplicate it to make a new offer.`);
  const result = await ctx.db.run(
    `UPDATE quotes SET status = 'draft', public_token_hash = NULL, sent_at = NULL, updated_at = ${NOW} WHERE id = ? AND status IN ('sent', 'expired')`,
    [id],
  );
  if (!result.meta.changes) throw conflict("This quote changed. Reload and try again.");
  await ctx.audit({ action: "quote.revised", entityType: "quote", entityId: id, summary: `Returned ${quote.number} to draft; the customer link no longer works` });
  return loadDetail(ctx, id);
}

/** Staff override: record the customer's answer (for example given by phone). */
export async function markQuote(ctx: ModuleContext, id: string, raw: QuoteMarkInput): Promise<QuoteDetail> {
  ctx.requireRole("member");
  const { status } = quoteMarkSchema.parse(raw);
  const quote = await requireStored(ctx, id);
  if (quote.status === "accepted" || quote.status === "declined") throw conflict(`This quote is already ${quote.status}.`);
  await recordAnswer(ctx, quote, status, { allowExpired: true });
  await ctx.audit({ action: `quote.${status}`, entityType: "quote", entityId: id, summary: `Marked ${quote.number} ${status}` });
  return loadDetail(ctx, id);
}

export async function duplicateQuote(ctx: ModuleContext, id: string): Promise<QuoteDetail> {
  ctx.requireRole("member");
  const source = await loadDetail(ctx, id);
  return createQuote(ctx, {
    contactId: source.contactId,
    dealId: source.dealId,
    notes: source.notes,
    terms: source.terms,
    lines: source.lines.map(({ productId, description, quantity, unit, unitPriceCents, vatRateBps, discountBps }) => ({ productId, description, quantity, unit, unitPriceCents, vatRateBps, discountBps })),
  });
}

/**
 * Sets accepted/declined once, guarded in SQL so double clicks and races
 * cannot answer twice. Emits the event other modules react to (CRM moves the
 * deal to won and writes the timeline).
 */
async function recordAnswer(
  ctx: ModuleContext,
  quote: { id: string; number: string; contactId: string; dealId: string | null; totalCents: number },
  status: "accepted" | "declined",
  options: { allowExpired: boolean },
): Promise<void> {
  const result = await ctx.db.run(
    options.allowExpired
      ? `UPDATE quotes SET status = ?, responded_at = ${NOW}, updated_at = ${NOW} WHERE id = ? AND status IN ('draft', 'sent', 'expired')`
      : `UPDATE quotes SET status = ?, responded_at = ${NOW}, updated_at = ${NOW} WHERE id = ? AND status = 'sent' AND valid_until >= ?`,
    options.allowExpired ? [status, quote.id] : [status, quote.id, today(ctx)],
  );
  if (!result.meta.changes) throw conflict("This quote can no longer be answered.");
  if (status === "accepted") {
    await ctx.emit("quote.accepted", { quoteId: quote.id, contactId: quote.contactId, dealId: quote.dealId, number: quote.number, totalCents: quote.totalCents });
  } else {
    await ctx.emit("quote.declined", { quoteId: quote.id, contactId: quote.contactId, dealId: quote.dealId, number: quote.number });
  }
}

// Public (customer) side

export function isTokenShaped(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/u.test(token);
}

/** Resolves a customer link. Returns null for unknown or revoked tokens. */
export async function findQuoteByToken(ctx: ModuleContext, token: string): Promise<QuoteDetail | null> {
  if (!isTokenShaped(token)) return null;
  const id = await ctx.db.value<string>("SELECT id FROM quotes WHERE public_token_hash = ?", [await sha256Hex(token)]);
  return id ? loadDetail(ctx, id) : null;
}

export type PublicAnswer = { outcome: "recorded" | "unchanged"; quote: QuoteDetail };

/**
 * The customer accepts or declines through the private link. Answering again
 * with the same choice is a no-op; anything else on a closed quote is a 409.
 */
export async function answerByToken(ctx: ModuleContext, token: string, status: "accepted" | "declined"): Promise<PublicAnswer> {
  const quote = await findQuoteByToken(ctx, token);
  if (!quote) throw notFound("Quote");
  if (quote.status === status) return { outcome: "unchanged", quote };
  if (quote.status === "expired") throw conflict(`This quote expired on ${quote.validUntil}. Ask for an updated quote.`);
  if (quote.status !== "sent") throw conflict(`This quote is already ${quote.status}.`);

  await recordAnswer(ctx, quote, status, { allowExpired: false });
  await ctx.audit({ action: `quote.${status}`, entityType: "quote", entityId: quote.id, summary: `${quote.contactName} ${status} ${quote.number} online` });

  const business = await ctx.business();
  if (business.email) {
    const total = formatMoney(quote.totalCents, quote.currency, ctx.locale);
    const verb = status === "accepted" ? "accepted" : "declined";
    const content = renderEmail({
      preheader: `${quote.contactName} ${verb} quote ${quote.number} (${total}).`,
      heading: `Quote ${quote.number} ${verb}`,
      paragraphs: [
        status === "accepted"
          ? `${quote.contactName} accepted the quote online. Confirm the order and plan the next step.`
          : `${quote.contactName} declined the quote online. Follow up to learn why, or duplicate it with a new offer.`,
      ],
      facts: [
        ["Customer", quote.contactName],
        ["Quote", quote.number],
        ["Total", total],
      ],
      action: { label: "Open the quote", url: `${appOrigin(ctx.env)}/app/quotes/${quote.id}` },
      footer: `${ctx.env.APP_NAME} · ${appOrigin(ctx.env)}`,
    });
    ctx.waitUntil(
      ctx.sendEmail({
        to: business.email,
        replyTo: quote.contact.email || undefined,
        subject: `${quote.contactName} ${verb} quote ${quote.number}`,
        template: `quotes.${verb}`,
        related: { type: "quote", id: quote.id },
        ...content,
      }),
    );
  }
  return { outcome: "recorded", quote: await loadDetail(ctx, quote.id) };
}

// Numbers for the dashboard

export async function openQuotes(ctx: ModuleContext): Promise<{ count: number; valueCents: number }> {
  const row = await ctx.db.first<{ count: number; value: number }>(
    "SELECT COUNT(*) AS count, COALESCE(SUM(total_cents), 0) AS value FROM quotes WHERE status = 'sent' AND valid_until >= ?",
    [today(ctx)],
  );
  return { count: row?.count ?? 0, valueCents: row?.value ?? 0 };
}

export async function acceptanceRate(ctx: ModuleContext, days = 90): Promise<{ rate: number; answered: number }> {
  const row = await ctx.db.first<{ accepted: number | null; answered: number }>(
    `SELECT SUM(status = 'accepted') AS accepted, COUNT(*) AS answered FROM quotes
     WHERE status IN ('accepted', 'declined') AND responded_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)`,
    [`-${days} days`],
  );
  const answered = row?.answered ?? 0;
  return { rate: answered ? (row?.accepted ?? 0) / answered : 0, answered };
}

export function describeQuote(quote: Pick<Quote, "status" | "contactName" | "totalCents" | "currency">, locale: string): string {
  return `${quote.contactName} · ${quoteStatusLabel(quote.status)} · ${formatMoney(quote.totalCents, quote.currency, locale)}`;
}

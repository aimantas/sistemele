import type { Page } from "@/shared/api";
import type { BusinessProfile } from "@/shared/business";
import { addDays, formatDate, todayDate } from "@/shared/dates";
import { newId } from "@/shared/ids";
import { linesSchema, priceLines, type Line, type PartySnapshot } from "@/shared/lines";
import { documentTotals, formatMoney } from "@/shared/money";
import type { ModuleContext } from "@/modules/types.server";
import { renderEmail } from "@/worker/email/layout";
import { appOrigin } from "@/worker/env";
import { randomToken, sha256Hex } from "@/worker/lib/crypto";
import { likePattern, parseJsonColumn, placeholders, type SqlValue } from "@/worker/lib/db";
import { AppError, conflict, notFound } from "@/worker/lib/errors";
import { gapFreeNumberStatements } from "@/worker/lib/sequences";
import {
  INVOICE_STATUSES,
  invoiceInputSchema,
  invoicePatchSchema,
  issueInputSchema,
  listQuerySchema,
  paymentInputSchema,
  voidInputSchema,
  type Invoice,
  type InvoiceActionResult,
  type InvoiceDetail,
  type InvoiceInput,
  type InvoiceLine,
  type InvoiceListQuery,
  type InvoicePatch,
  type InvoicePayment,
  type InvoiceStatus,
  type IssueInput,
  type PaymentInput,
  type SellerSnapshot,
} from "../shared/schema";

/**
 * Invoice services. Routes, MCP tools and tests call these; each validates
 * its own input, checks the role and writes an audit entry.
 *
 * Lifecycle: draft (no number, editable) → issued (numbered, immutable) →
 * paid (payments cover the total). Issued or paid invoices can be voided by
 * an admin; the number stays used and payments are kept.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const INVOICE_COLUMNS = `i.id, i.number, i.contact_id AS contactId, c.name AS contactName, i.quote_id AS quoteId, i.status,
  i.issue_date AS issueDate, i.due_date AS dueDate, i.currency, i.subtotal_cents AS subtotalCents, i.vat_cents AS vatCents,
  i.total_cents AS totalCents, i.paid_cents AS paidCents, i.notes, i.void_reason AS voidReason, i.issued_at AS issuedAt,
  i.paid_at AS paidAt, i.voided_at AS voidedAt, i.created_at AS createdAt, i.updated_at AS updatedAt`;
const INVOICE_FROM = "FROM invoices i JOIN contacts c ON c.id = i.contact_id";

const LINE_COLUMNS = `id, position, product_id AS productId, description, quantity, unit, unit_price_cents AS unitPriceCents,
  vat_rate_bps AS vatRateBps, discount_bps AS discountBps, subtotal_cents AS subtotalCents`;

type InvoiceRow = Omit<Invoice, "overdue" | "daysOverdue" | "amountDueCents">;
type InvoiceRecord = InvoiceRow & { seller: string | null; buyer: string | null; publicTokenHash: string | null };

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
}

/** Thrown when a quote already has a live invoice. Routes add `invoiceId` to the JSON body. */
export class InvoiceExistsError extends AppError {
  constructor(
    message: string,
    readonly invoiceId: string,
  ) {
    super(409, "conflict", message);
  }
}

const unprocessable = (message: string, issues?: Record<string, string>) => new AppError(422, "validation_failed", message, issues);

export function today(ctx: ModuleContext): string {
  return todayDate(ctx.timezone);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function toInvoice(row: InvoiceRow, todayIso: string): Invoice {
  const overdue = row.status === "issued" && row.dueDate !== null && row.dueDate < todayIso;
  return {
    ...row,
    overdue,
    daysOverdue: overdue && row.dueDate ? daysBetween(row.dueDate, todayIso) : 0,
    amountDueCents: row.status === "void" ? 0 : Math.max(0, row.totalCents - row.paidCents),
  };
}

const statusLabel = (status: InvoiceStatus) => INVOICE_STATUSES.find((item) => item.id === status)?.label ?? status;
const describe = (row: { number: string | null }) => (row.number ? `Invoice ${row.number}` : "This draft invoice");

// Snapshots

export function sellerSnapshot(business: BusinessProfile): SellerSnapshot {
  return {
    name: business.legalName || business.name,
    companyCode: business.companyCode,
    vatCode: business.vatCode,
    address: business.address,
    email: business.email,
    phone: business.phone,
    bank: { name: business.bankName, iban: business.iban },
    footer: business.invoiceFooter,
  };
}

export function buyerSnapshot(contact: ContactRow): PartySnapshot {
  return {
    name: contact.name,
    companyCode: contact.companyCode,
    vatCode: contact.vatCode,
    address: [contact.address, [contact.postalCode, contact.city].filter(Boolean).join(" "), contact.country].filter(Boolean).join(", "),
    email: contact.email,
    phone: contact.phone,
  };
}

function parseSeller(value: string | null, fallback: SellerSnapshot): SellerSnapshot {
  const parsed = parseJsonColumn<Partial<SellerSnapshot> | null>(value, null);
  if (!parsed) return fallback;
  return { ...fallback, ...parsed, bank: { name: parsed.bank?.name ?? "", iban: parsed.bank?.iban ?? "" }, footer: parsed.footer ?? "" };
}

// Reads

async function findRecord(ctx: ModuleContext, id: string): Promise<InvoiceRecord | null> {
  return ctx.db.first<InvoiceRecord>(`SELECT ${INVOICE_COLUMNS}, i.seller, i.buyer, i.public_token_hash AS publicTokenHash ${INVOICE_FROM} WHERE i.id = ?`, [id]);
}

async function loadRecord(ctx: ModuleContext, id: string): Promise<InvoiceRecord> {
  const record = await findRecord(ctx, id);
  if (!record) throw notFound("Invoice");
  return record;
}

async function loadContact(ctx: ModuleContext, id: string): Promise<ContactRow | null> {
  return ctx.db.first<ContactRow>(
    `SELECT id, name, email, phone, company_code AS companyCode, vat_code AS vatCode, address, city, postal_code AS postalCode, country
     FROM contacts WHERE id = ?`,
    [id],
  );
}

async function loadLines(ctx: ModuleContext, invoiceId: string): Promise<InvoiceLine[]> {
  return ctx.db.all<InvoiceLine>(`SELECT ${LINE_COLUMNS} FROM invoice_lines WHERE invoice_id = ? ORDER BY position`, [invoiceId]);
}

export async function listInvoices(ctx: ModuleContext, raw: InvoiceListQuery = {}): Promise<Page<Invoice>> {
  ctx.requireRole("member");
  const options = listQuerySchema.parse(raw);
  const todayIso = today(ctx);
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (options.status === "overdue") {
    where.push("i.status = 'issued' AND i.due_date < ?");
    params.push(todayIso);
  } else if (options.status) {
    where.push("i.status = ?");
    params.push(options.status);
  }
  if (options.contactId) {
    where.push("i.contact_id = ?");
    params.push(options.contactId);
  }
  if (options.q?.trim()) {
    const pattern = likePattern(options.q.trim());
    where.push("(i.number LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order = options.status === "overdue" ? "i.due_date ASC, i.number ASC" : "COALESCE(i.issued_at, i.created_at) DESC, i.created_at DESC";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const [rows, total] = await Promise.all([
    ctx.db.all<InvoiceRow>(`SELECT ${INVOICE_COLUMNS} ${INVOICE_FROM} ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    ctx.db.value<number>(`SELECT COUNT(*) ${INVOICE_FROM} ${whereSql}`, params),
  ]);
  return { items: rows.map((row) => toInvoice(row, todayIso)), total: total ?? 0 };
}

export async function getInvoice(ctx: ModuleContext, id: string): Promise<InvoiceDetail> {
  ctx.requireRole("member");
  const record = await loadRecord(ctx, id);
  const [lines, payments, contact, quoteNumber] = await Promise.all([
    loadLines(ctx, id),
    ctx.db.all<InvoicePayment>(
      `SELECT p.id, p.amount_cents AS amountCents, p.paid_on AS paidOn, p.method, p.reference, u.name AS createdByName, p.created_at AS createdAt
       FROM invoice_payments p LEFT JOIN users u ON u.id = p.created_by WHERE p.invoice_id = ? ORDER BY p.paid_on, p.created_at`,
      [id],
    ),
    loadContact(ctx, record.contactId),
    record.quoteId ? ctx.db.value<string>("SELECT number FROM quotes WHERE id = ?", [record.quoteId]) : Promise.resolve(null),
  ]);
  const liveSeller = sellerSnapshot(await ctx.business());
  const { seller: sellerJson, buyer: buyerJson, publicTokenHash, ...row } = record;
  const liveBuyer = contact ? buyerSnapshot(contact) : { name: record.contactName, companyCode: "", vatCode: "", address: "", email: "", phone: "" };
  return {
    ...toInvoice(row, today(ctx)),
    lines,
    vatGroups: documentTotals(lines).vatGroups,
    payments,
    contact: { id: record.contactId, name: contact?.name ?? record.contactName, email: contact?.email ?? "" },
    quoteNumber,
    seller: record.status === "draft" ? liveSeller : parseSeller(sellerJson, liveSeller),
    buyer: record.status === "draft" ? liveBuyer : parseJsonColumn<PartySnapshot>(buyerJson, liveBuyer),
    hasPublicLink: Boolean(publicTokenHash),
  };
}

// Drafts

async function assertContact(ctx: ModuleContext, contactId: string): Promise<ContactRow> {
  const contact = await loadContact(ctx, contactId);
  if (!contact) throw unprocessable("Choose a contact that exists.", { contactId: "Choose a contact." });
  return contact;
}

async function assertProducts(ctx: ModuleContext, lines: Line[]): Promise<void> {
  const ids = [...new Set(lines.map((line) => line.productId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const found = new Set((await ctx.db.all<{ id: string }>(`SELECT id FROM products WHERE id IN (${placeholders(ids.length)})`, ids)).map((row) => row.id));
  const issues: Record<string, string> = {};
  lines.forEach((line, index) => {
    if (line.productId && !found.has(line.productId)) issues[`lines.${index}.productId`] = "This product no longer exists. Pick it again or remove the link.";
  });
  if (Object.keys(issues).length) throw unprocessable("A line refers to a product that no longer exists.", issues);
}

/** Line inserts that only run while the invoice is still a draft. */
function lineStatements(ctx: ModuleContext, invoiceId: string, lines: ReturnType<typeof priceLines>["lines"]): D1PreparedStatement[] {
  return lines.map((line) =>
    ctx.db.prepare(
      `INSERT INTO invoice_lines (id, invoice_id, position, product_id, description, quantity, unit, unit_price_cents, vat_rate_bps, discount_bps, subtotal_cents)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft')`,
      [newId("il"), invoiceId, line.position, line.productId, line.description, line.quantity, line.unit, line.unitPriceCents, line.vatRateBps, line.discountBps, line.subtotalCents, invoiceId],
    ),
  );
}

function assertDraft(record: InvoiceRecord, action: "changed" | "deleted"): void {
  if (record.status === "draft") return;
  throw conflict(
    action === "deleted"
      ? `${describe(record)} is ${statusLabel(record.status).toLowerCase()} and cannot be deleted. Void it instead.`
      : `${describe(record)} is ${statusLabel(record.status).toLowerCase()} and can no longer be changed. Void it and create a new invoice.`,
  );
}

export async function createDraft(ctx: ModuleContext, raw: InvoiceInput): Promise<InvoiceDetail> {
  const user = ctx.requireRole("member");
  const input = invoiceInputSchema.parse(raw);
  await assertContact(ctx, input.contactId);
  await assertProducts(ctx, input.lines);
  const business = await ctx.business();
  const { lines, totals } = priceLines(input.lines);
  const id = newId("inv");
  await ctx.db.batch([
    ctx.db.prepare(
      `INSERT INTO invoices (id, contact_id, status, due_date, currency, subtotal_cents, vat_cents, total_cents, notes, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.contactId, input.dueDate || null, business.currency, totals.subtotalCents, totals.vatCents, totals.totalCents, input.notes, user.id],
    ),
    ...lineStatements(ctx, id, lines),
  ]);
  await ctx.audit({ action: "invoice.created", entityType: "invoice", entityId: id, summary: `Created a draft invoice (${formatMoney(totals.totalCents, business.currency, ctx.locale)})` });
  return getInvoice(ctx, id);
}

export async function updateDraft(ctx: ModuleContext, id: string, raw: InvoicePatch): Promise<InvoiceDetail> {
  ctx.requireRole("member");
  const record = await loadRecord(ctx, id);
  assertDraft(record, "changed");
  const patch = invoicePatchSchema.parse(raw);
  if (patch.contactId) await assertContact(ctx, patch.contactId);
  if (patch.lines) await assertProducts(ctx, patch.lines);
  const priced = patch.lines ? priceLines(patch.lines) : null;
  const results = await ctx.db.batch([
    ctx.db.prepare(
      `UPDATE invoices SET contact_id = COALESCE(?, contact_id), due_date = CASE WHEN ? THEN ? ELSE due_date END, notes = COALESCE(?, notes),
         subtotal_cents = COALESCE(?, subtotal_cents), vat_cents = COALESCE(?, vat_cents), total_cents = COALESCE(?, total_cents), updated_at = ${NOW}
       WHERE id = ? AND status = 'draft'`,
      [
        patch.contactId ?? null,
        patch.dueDate !== undefined ? 1 : 0,
        patch.dueDate || null,
        patch.notes ?? null,
        priced?.totals.subtotalCents ?? null,
        priced?.totals.vatCents ?? null,
        priced?.totals.totalCents ?? null,
        id,
      ],
    ),
    ...(priced
      ? [ctx.db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft')", [id, id]), ...lineStatements(ctx, id, priced.lines)]
      : []),
  ]);
  if (!results[0]?.meta.changes) assertDraft(await loadRecord(ctx, id), "changed");
  const fields = Object.keys(patch).filter((key) => patch[key as keyof InvoicePatch] !== undefined);
  await ctx.audit({ action: "invoice.updated", entityType: "invoice", entityId: id, summary: `Updated draft invoice: ${fields.join(", ") || "no changes"}` });
  return getInvoice(ctx, id);
}

export async function deleteDraft(ctx: ModuleContext, id: string): Promise<void> {
  ctx.requireRole("member");
  const record = await loadRecord(ctx, id);
  assertDraft(record, "deleted");
  const results = await ctx.db.batch([
    ctx.db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft')", [id, id]),
    ctx.db.prepare("DELETE FROM invoices WHERE id = ? AND status = 'draft'", [id]),
  ]);
  if (!results[1]?.meta.changes) assertDraft(await loadRecord(ctx, id), "deleted");
  await ctx.audit({ action: "invoice.deleted", entityType: "invoice", entityId: id, summary: `Deleted a draft invoice for ${record.contactName}` });
}

// From an accepted quote

async function assertQuoteNotInvoiced(ctx: ModuleContext, quote: { id: string; number: string }): Promise<void> {
  const existing = await ctx.db.first<{ id: string; number: string | null }>("SELECT id, number FROM invoices WHERE quote_id = ? AND status <> 'void' LIMIT 1", [quote.id]);
  if (!existing) return;
  throw new InvoiceExistsError(
    existing.number ? `Quote ${quote.number} is already invoiced as ${existing.number}.` : `Quote ${quote.number} already has a draft invoice.`,
    existing.id,
  );
}

export async function createFromQuote(ctx: ModuleContext, quoteId: string): Promise<InvoiceDetail> {
  const user = ctx.requireRole("member");
  const quote = await ctx.db.first<{ id: string; number: string; contactId: string; status: string; currency: string; notes: string }>(
    "SELECT id, number, contact_id AS contactId, status, currency, notes FROM quotes WHERE id = ?",
    [quoteId],
  );
  if (!quote) throw notFound("Quote");
  if (quote.status !== "accepted") throw new AppError(422, "quote_not_accepted", `Quote ${quote.number} is ${quote.status}. Only accepted quotes can be invoiced.`);
  await assertQuoteNotInvoiced(ctx, quote);

  const rows = await ctx.db.all<Line>(
    `SELECT product_id AS productId, description, quantity, unit, unit_price_cents AS unitPriceCents, vat_rate_bps AS vatRateBps, discount_bps AS discountBps
     FROM quote_lines WHERE quote_id = ? ORDER BY position`,
    [quote.id],
  );
  if (!rows.length) throw unprocessable(`Quote ${quote.number} has no lines to invoice.`);
  const { lines, totals } = priceLines(linesSchema.parse(rows));
  const id = newId("inv");
  try {
    await ctx.db.batch([
      ctx.db.prepare(
        `INSERT INTO invoices (id, contact_id, quote_id, status, currency, subtotal_cents, vat_cents, total_cents, notes, created_by)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
        [id, quote.contactId, quote.id, quote.currency, totals.subtotalCents, totals.vatCents, totals.totalCents, quote.notes, user.id],
      ),
      ...lineStatements(ctx, id, lines),
    ]);
  } catch (error) {
    // Two requests at once: the partial unique index on quote_id lets one win.
    await assertQuoteNotInvoiced(ctx, quote);
    throw error;
  }
  await ctx.audit({ action: "invoice.created", entityType: "invoice", entityId: id, summary: `Created a draft invoice from quote ${quote.number}`, data: { quoteId: quote.id } });
  return getInvoice(ctx, id);
}

// Issue and send

export async function issueInvoice(ctx: ModuleContext, id: string, raw: IssueInput = {}): Promise<InvoiceActionResult> {
  ctx.requireRole("member");
  const input = issueInputSchema.parse(raw ?? {});
  const record = await loadRecord(ctx, id);
  if (record.status !== "draft") throw conflict(`${describe(record)} is already ${statusLabel(record.status).toLowerCase()}.`);
  const contact = await assertContact(ctx, record.contactId);
  if (input.send && !contact.email) throw unprocessable(`Add an email address to ${contact.name} before sending, or issue without sending.`, { send: "The contact has no email address." });
  const lines = await loadLines(ctx, id);
  if (!lines.length) throw unprocessable("Add at least one line before issuing.", { lines: "Add at least one line." });

  const business = await ctx.business();
  const issueDate = input.issueDate ?? today(ctx);
  const dueDate = input.dueDate ?? (record.dueDate && record.dueDate >= issueDate ? record.dueDate : addDays(issueDate, business.paymentTermsDays));
  if (dueDate < issueDate) throw unprocessable("The due date cannot be before the issue date.", { dueDate: "Pick a date on or after the issue date." });

  const statements = [
    // Aborts the whole batch (NOT NULL violation) unless the invoice is still a
    // draft, so a repeated or concurrent issue never consumes or rewrites a number.
    ctx.db.prepare("INSERT INTO sequences (name, value) SELECT 'invoice-issue-guard', NULL WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft')", [id]),
    ...gapFreeNumberStatements(ctx.db, "invoices", id, business.invoicePrefix, Number(issueDate.slice(0, 4))),
    ctx.db.prepare(
      `UPDATE invoices SET status = 'issued', issue_date = ?, due_date = ?, seller = ?, buyer = ?, issued_at = ${NOW}, updated_at = ${NOW}
       WHERE id = ? AND status = 'draft'`,
      [issueDate, dueDate, JSON.stringify(sellerSnapshot(business)), JSON.stringify(buyerSnapshot(contact)), id],
    ),
  ];
  const changed = await ctx.db.batch(statements).then(
    (results) => results.at(-1)?.meta.changes ?? 0,
    async (error: unknown) => {
      const fresh = await findRecord(ctx, id);
      if (fresh && fresh.status !== "draft") throw conflict(`${describe(fresh)} is already ${statusLabel(fresh.status).toLowerCase()}.`);
      throw error;
    },
  );
  if (!changed) throw conflict("The invoice changed while it was being issued. Reload and try again.");

  const issued = await loadRecord(ctx, id);
  const number = issued.number ?? "";
  await ctx.audit({ action: "invoice.issued", entityType: "invoice", entityId: id, summary: `Issued ${number} (${formatMoney(issued.totalCents, issued.currency, ctx.locale)})` });
  await ctx.emit("invoice.issued", {
    invoiceId: id,
    contactId: issued.contactId,
    number,
    totalCents: issued.totalCents,
    lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
  });
  if (input.send) return sendInvoice(ctx, id);
  return { invoice: await getInvoice(ctx, id), publicUrl: null };
}

/** Emails the customer a fresh private link (/i/:token). A new send replaces the previous link. */
export async function sendInvoice(ctx: ModuleContext, id: string): Promise<InvoiceActionResult> {
  ctx.requireRole("member");
  const record = await loadRecord(ctx, id);
  if (record.status === "draft") throw conflict("Issue the invoice before sending it.");
  if (record.status === "void") throw conflict(`${describe(record)} is void and cannot be sent.`);
  const contact = await loadContact(ctx, record.contactId);
  const buyer = parseJsonColumn<PartySnapshot | null>(record.buyer, null);
  const email = contact?.email || buyer?.email || "";
  if (!email) throw unprocessable(`Add an email address to ${record.contactName} first.`, { email: "The contact has no email address." });

  const token = randomToken();
  await ctx.db.run(`UPDATE invoices SET public_token_hash = ?, updated_at = ${NOW} WHERE id = ?`, [await sha256Hex(token), id]);
  const publicUrl = `${appOrigin(ctx.env)}/i/${token}`;

  const business = await ctx.business();
  const seller = parseSeller(record.seller, sellerSnapshot(business));
  const number = record.number ?? "";
  const money = (cents: number) => formatMoney(cents, record.currency, ctx.locale);
  const amountDue = Math.max(0, record.totalCents - record.paidCents);
  const iban = seller.bank.iban;
  const facts: Array<[string, string]> = [
    ["Invoice", number],
    ["Total", money(record.totalCents)],
    ["Amount due", money(amountDue)],
    ["Due date", formatDate(record.dueDate, ctx.locale)],
  ];
  if (iban && amountDue > 0) {
    if (seller.bank.name) facts.push(["Bank", seller.bank.name]);
    facts.push(["IBAN", iban], ["Payment reference", number]);
  }
  const content = renderEmail({
    preheader: `Invoice ${number} for ${money(record.totalCents)}${amountDue > 0 ? `, due ${formatDate(record.dueDate, ctx.locale)}` : ""}.`,
    heading: `Invoice ${number}`,
    paragraphs: [
      `${seller.name} sent you invoice ${number}.`,
      amountDue === 0
        ? "It is paid in full. Keep it for your records."
        : iban
          ? `Pay ${money(amountDue)} by bank transfer to the account below and use ${number} as the payment reference.`
          : "Open the invoice to see the lines and how to pay.",
    ],
    facts,
    action: { label: "View invoice", url: publicUrl },
    footer: [seller.footer, [seller.name, seller.email].filter(Boolean).join(" · ")].filter(Boolean).join(" "),
  });
  const result = await ctx.sendEmail({
    to: email,
    replyTo: business.email || undefined,
    subject: `Invoice ${number} from ${seller.name}`,
    template: "invoices.sent",
    related: { type: "invoice", id },
    ...content,
  });
  await ctx.audit({ action: "invoice.sent", entityType: "invoice", entityId: id, summary: `Sent ${number} to ${email}`, data: { emailStatus: result.status } });
  return { invoice: await getInvoice(ctx, id), publicUrl, emailStatus: result.status };
}

// Payments

/** Recomputes paid_cents from payments and moves issued ↔ paid. Void and draft keep their status. */
function recomputePaymentsStatement(ctx: ModuleContext, id: string): D1PreparedStatement {
  const paid = "(SELECT COALESCE(SUM(amount_cents), 0) FROM invoice_payments WHERE invoice_id = invoices.id)";
  return ctx.db.prepare(
    `UPDATE invoices SET
       paid_cents = ${paid},
       status = CASE WHEN status IN ('issued', 'paid') AND ${paid} >= total_cents THEN 'paid' WHEN status = 'paid' THEN 'issued' ELSE status END,
       paid_at = CASE WHEN status IN ('issued', 'paid') AND ${paid} >= total_cents THEN COALESCE(paid_at, ${NOW}) WHEN status = 'paid' THEN NULL ELSE paid_at END,
       updated_at = ${NOW}
     WHERE id = ?`,
    [id],
  );
}

export async function recordPayment(ctx: ModuleContext, id: string, raw: PaymentInput): Promise<InvoiceDetail> {
  const user = ctx.requireRole("member");
  const record = await loadRecord(ctx, id);
  if (record.status === "draft") throw conflict("Issue the invoice before recording a payment.");
  if (record.status === "paid") throw conflict(`${describe(record)} is already paid in full.`);
  if (record.status === "void") throw conflict(`${describe(record)} is void. Payments cannot be added.`);
  const input = paymentInputSchema.parse(raw);
  const due = record.totalCents - record.paidCents;
  const money = (cents: number) => formatMoney(cents, record.currency, ctx.locale);
  if (input.amountCents > due) throw unprocessable(`The amount is more than the ${money(due)} still due.`, { amountCents: `Enter at most ${money(due)}.` });

  const paymentId = newId("pay");
  const results = await ctx.db.batch([
    ctx.db.prepare(
      `INSERT INTO invoice_payments (id, invoice_id, amount_cents, paid_on, method, reference, created_by)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'issued' AND total_cents - paid_cents >= ?)`,
      [paymentId, id, input.amountCents, input.paidOn, input.method, input.reference, user.id, id, input.amountCents],
    ),
    recomputePaymentsStatement(ctx, id),
  ]);
  if (!results[0]?.meta.changes) throw conflict("The invoice changed while the payment was being recorded. Reload and try again.");

  const after = await loadRecord(ctx, id);
  await ctx.audit({ action: "invoice.payment_recorded", entityType: "invoice", entityId: id, summary: `Recorded ${money(input.amountCents)} on ${after.number}`, data: { paymentId, method: input.method } });
  if (after.status === "paid") {
    await ctx.audit({ action: "invoice.paid", entityType: "invoice", entityId: id, summary: `${after.number} paid in full` });
    await ctx.emit("invoice.paid", { invoiceId: id, contactId: after.contactId, number: after.number ?? "", totalCents: after.totalCents });
  }
  return getInvoice(ctx, id);
}

export async function deletePayment(ctx: ModuleContext, id: string, paymentId: string): Promise<InvoiceDetail> {
  ctx.requireRole("admin");
  const record = await loadRecord(ctx, id);
  if (record.status === "void") throw conflict(`${describe(record)} is void. Its payments stay on record.`);
  const results = await ctx.db.batch([
    ctx.db.prepare(
      "DELETE FROM invoice_payments WHERE id = ? AND invoice_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status IN ('issued', 'paid'))",
      [paymentId, id, id],
    ),
    recomputePaymentsStatement(ctx, id),
  ]);
  if (!results[0]?.meta.changes) throw notFound("Payment");
  const after = await loadRecord(ctx, id);
  await ctx.audit({
    action: "invoice.payment_deleted",
    entityType: "invoice",
    entityId: id,
    summary: `Deleted a payment on ${after.number}${record.status === "paid" && after.status === "issued" ? "; it is unpaid again" : ""}`,
    data: { paymentId },
  });
  return getInvoice(ctx, id);
}

// Void

export async function voidInvoice(ctx: ModuleContext, id: string, raw: { reason: string }): Promise<InvoiceDetail> {
  ctx.requireRole("admin");
  const record = await loadRecord(ctx, id);
  if (record.status === "draft") throw conflict("Drafts have no number yet. Delete the draft instead.");
  if (record.status === "void") throw conflict(`${describe(record)} is already void.`);
  const { reason } = voidInputSchema.parse(raw);
  const result = await ctx.db.run(
    `UPDATE invoices SET status = 'void', voided_at = ${NOW}, void_reason = ?, updated_at = ${NOW} WHERE id = ? AND status IN ('issued', 'paid')`,
    [reason, id],
  );
  if (!result.meta.changes) throw conflict("The invoice changed while it was being voided. Reload and try again.");
  const lines = await loadLines(ctx, id);
  await ctx.audit({ action: "invoice.voided", entityType: "invoice", entityId: id, summary: `Voided ${record.number}: ${reason}` });
  await ctx.emit("invoice.voided", {
    invoiceId: id,
    contactId: record.contactId,
    number: record.number ?? "",
    lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
  });
  return getInvoice(ctx, id);
}

// Public page

export interface PublicInvoice {
  invoice: Invoice;
  lines: InvoiceLine[];
  seller: SellerSnapshot;
  buyer: PartySnapshot;
}

/** No role check: the caller proved access with the private link token. */
export async function getPublicInvoice(ctx: ModuleContext, token: string): Promise<PublicInvoice | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/u.test(token)) return null;
  const record = await ctx.db.first<InvoiceRecord>(
    `SELECT ${INVOICE_COLUMNS}, i.seller, i.buyer, i.public_token_hash AS publicTokenHash ${INVOICE_FROM} WHERE i.public_token_hash = ? AND i.status <> 'draft'`,
    [await sha256Hex(token)],
  );
  if (!record) return null;
  const { seller, buyer, publicTokenHash: _hash, ...row } = record;
  const fallbackSeller = sellerSnapshot(await ctx.business());
  return {
    invoice: toInvoice(row, today(ctx)),
    lines: await loadLines(ctx, record.id),
    seller: parseSeller(seller, fallbackSeller),
    buyer: parseJsonColumn<PartySnapshot>(buyer, { name: record.contactName, companyCode: "", vatCode: "", address: "", email: "", phone: "" }),
  };
}

// Numbers for the dashboard

export async function invoiceTotals(ctx: ModuleContext, kind: "revenue_30d" | "outstanding" | "overdue"): Promise<{ count: number; cents: number }> {
  const todayIso = today(ctx);
  const query = {
    revenue_30d: ["SELECT COUNT(*) AS count, COALESCE(SUM(total_cents), 0) AS cents FROM invoices WHERE status IN ('issued', 'paid') AND issue_date >= ?", [addDays(todayIso, -30)]],
    outstanding: ["SELECT COUNT(*) AS count, COALESCE(SUM(total_cents - paid_cents), 0) AS cents FROM invoices WHERE status = 'issued'", []],
    overdue: ["SELECT COUNT(*) AS count, COALESCE(SUM(total_cents - paid_cents), 0) AS cents FROM invoices WHERE status = 'issued' AND due_date < ?", [todayIso]],
  } as const satisfies Record<string, readonly [string, readonly SqlValue[]]>;
  const [sql, params] = query[kind];
  const row = await ctx.db.first<{ count: number; cents: number }>(sql, params);
  return { count: row?.count ?? 0, cents: row?.cents ?? 0 };
}

export async function searchInvoices(ctx: ModuleContext, term: string): Promise<Array<{ id: string; number: string | null; status: InvoiceStatus; totalCents: number; currency: string; contactName: string }>> {
  const pattern = likePattern(term);
  return ctx.db.all(
    `SELECT i.id, i.number, i.status, i.total_cents AS totalCents, i.currency, c.name AS contactName ${INVOICE_FROM}
     WHERE i.number LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' ORDER BY COALESCE(i.issued_at, i.created_at) DESC LIMIT 8`,
    [pattern, pattern],
  );
}

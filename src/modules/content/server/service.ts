import { isDemoVisitorRecord } from "@/worker/env";
import type { Page, SearchResult } from "@/shared/api";
import { roleAtLeast, type SessionUser } from "@/shared/auth";
import { nowIso } from "@/shared/dates";
import { newId } from "@/shared/ids";
import { slugify } from "@/shared/slug";
import type { ModuleContext, SitemapEntry } from "@/modules/types.server";
import { likePattern, type SqlValue } from "@/worker/lib/db";
import { AppError, badRequest, forbidden, notFound } from "@/worker/lib/errors";
import type { SiteLink } from "@/worker/site/Layout";
import {
  ENTRY_TYPE_LABELS,
  HOME_SLUG,
  RESERVED_PAGE_SLUGS,
  entryInputSchema,
  entryPatchSchema,
  entryPath,
  entryState,
  publishInputSchema,
  type Entry,
  type EntryInput,
  type EntryListQuery,
  type EntryPatch,
  type EntryState,
  type EntryStatus,
  type EntrySummary,
  type EntryType,
  type PublishInput,
} from "../shared/schema";
import { excerpt, markdownText } from "../shared/markdown";

/**
 * Content services: website pages and blog posts. Routes, MCP tools, the
 * public site and tests call these; they validate their own input.
 *
 * Who may do what:
 * - members create entries (always as drafts) and edit drafts;
 * - owners and admins publish, schedule, unpublish and edit what is live.
 * An API token with the member role can therefore draft but never publish.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
/** Public right now: published, with a publish time that has passed. Pass "e." when the table is aliased. */
const live = (alias = "") => `${alias}status = 'published' AND ${alias}published_at <= ${NOW}`;

const SUMMARY_COLUMNS = `e.id, e.type, e.slug, e.title, e.summary, e.image_url AS imageUrl, e.image_alt AS imageAlt, e.menu_order AS menuOrder,
  e.status, e.published_at AS publishedAt, COALESCE(NULLIF(u.name, ''), u.email) AS updatedByName, e.created_at AS createdAt, e.updated_at AS updatedAt`;
const FROM = "content_entries e LEFT JOIN users u ON u.id = e.updated_by";

type Row = Omit<EntrySummary, "path" | "state"> & { body?: string };

function toEntry<T extends Row>(row: T): T & { path: string; state: EntryState } {
  return { ...row, path: entryPath(row.type, row.slug), state: entryState(row) };
}

const label = (type: EntryType) => ENTRY_TYPE_LABELS[type].one;
const capitalised = (type: EntryType) => label(type)[0].toUpperCase() + label(type).slice(1);

function slugError(message: string): AppError {
  return new AppError(409, "conflict", message, { slug: message });
}

// Reading (staff)

export async function listEntries(ctx: ModuleContext, raw: EntryListQuery = {}): Promise<Page<EntrySummary>> {
  ctx.requireRole("member");
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (raw.type) {
    where.push("e.type = ?");
    params.push(raw.type);
  }
  switch (raw.state) {
    case undefined:
      where.push("e.status <> 'archived'");
      break;
    case "scheduled":
      where.push(`e.status = 'published' AND e.published_at > ${NOW}`);
      break;
    case "published":
      where.push(`e.status = 'published' AND e.published_at <= ${NOW}`);
      break;
    default:
      where.push("e.status = ?");
      params.push(raw.state);
  }
  if (raw.q?.trim()) {
    const pattern = likePattern(raw.q.trim());
    where.push("(e.title LIKE ? ESCAPE '\\' OR e.slug LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(raw.limit ?? 50, 1), 200);
  const offset = Math.max(raw.offset ?? 0, 0);
  const [rows, total] = await Promise.all([
    ctx.db.all<Row>(`SELECT ${SUMMARY_COLUMNS} FROM ${FROM} ${whereSql} ORDER BY e.updated_at DESC, e.id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    ctx.db.value<number>(`SELECT COUNT(*) FROM content_entries e ${whereSql}`, params),
  ]);
  return { items: rows.map(toEntry), total: total ?? 0 };
}

async function findEntry(ctx: ModuleContext, id: string): Promise<Entry | null> {
  const row = await ctx.db.first<Row & { body: string }>(`SELECT ${SUMMARY_COLUMNS}, e.body FROM ${FROM} WHERE e.id = ?`, [id]);
  return row ? toEntry(row) : null;
}

export async function getEntry(ctx: ModuleContext, id: string): Promise<Entry> {
  ctx.requireRole("member");
  const entry = await findEntry(ctx, id);
  if (!entry) throw notFound("Entry");
  return entry;
}

/** Accepts an entry id (cnt_…) or a public path such as "/about" or "/blog/first-post". Used by MCP tools. */
export async function getEntryByRef(ctx: ModuleContext, ref: string): Promise<Entry> {
  ctx.requireRole("member");
  const value = ref.trim();
  const post = /^\/?blog\/([^/]+)\/?$/u.exec(value);
  const page = value === "/" ? [value, HOME_SLUG] : /^\/([^/]+)\/?$/u.exec(value);
  const match = post ? (["post", post[1]] as const) : page ? (["page", page[1]] as const) : null;
  const row = match
    ? await ctx.db.first<{ id: string }>("SELECT id FROM content_entries WHERE type = ? AND slug = ?", [match[0], match[1].toLowerCase()])
    : await ctx.db.first<{ id: string }>("SELECT id FROM content_entries WHERE id = ?", [value]);
  if (!row) throw notFound("Entry");
  return getEntry(ctx, row.id);
}

// Writing

async function assertSlugUsable(ctx: ModuleContext, type: EntryType, slug: string, exceptId = ""): Promise<void> {
  if (type === "page" && RESERVED_PAGE_SLUGS.includes(slug)) throw slugError(`/${slug} is used by the system. Choose another address.`);
  const taken = await ctx.db.first<{ title: string }>("SELECT title FROM content_entries WHERE type = ? AND slug = ? AND id <> ?", [type, slug, exceptId]);
  if (taken) throw slugError(`${entryPath(type, slug)} is already used by “${taken.title}”. Choose another address.`);
}

/** "about", then "about-2", "about-3" … skipping reserved page addresses. */
async function uniqueSlug(ctx: ModuleContext, type: EntryType, base: string): Promise<string> {
  const rows = await ctx.db.all<{ slug: string }>("SELECT slug FROM content_entries WHERE type = ? AND (slug = ? OR slug LIKE ?)", [type, base, `${base}-%`]);
  const taken = new Set(rows.map((row) => row.slug));
  if (type === "page") for (const reserved of RESERVED_PAGE_SLUGS) taken.add(reserved);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

const isSlugUniqueError = (error: unknown) => error instanceof Error && error.message.includes("UNIQUE") && error.message.includes("content_entries");

function assertMenuAllowed(type: EntryType, menuOrder: number | null | undefined): void {
  if (type === "post" && menuOrder !== undefined && menuOrder !== null) throw badRequest("Only pages can be in the site menu.", { menuOrder: "Only pages can be in the site menu." });
}

/** Creates a draft. Drafts are never public. */
export async function createEntry(ctx: ModuleContext, raw: EntryInput): Promise<Entry> {
  const user = ctx.requireRole("member");
  const input = entryInputSchema.parse(raw);
  assertMenuAllowed(input.type, input.menuOrder);
  if (input.slug) await assertSlugUsable(ctx, input.type, input.slug);
  const id = newId("cnt");

  for (let attempt = 0; ; attempt++) {
    const slug = input.slug ?? (await uniqueSlug(ctx, input.type, slugify(input.title, input.type)));
    try {
      await ctx.db.run(
        `INSERT INTO content_entries (id, type, slug, title, summary, body, image_url, image_alt, menu_order, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, input.type, slug, input.title, input.summary, input.body, input.imageUrl, input.imageAlt, input.menuOrder, user.id, user.id],
      );
      break;
    } catch (error) {
      if (!isSlugUniqueError(error)) throw error;
      if (input.slug) throw slugError(`${entryPath(input.type, input.slug)} is already used. Choose another address.`);
      // Two entries with the same title saved at once: take the next number.
      if (attempt >= 3) throw error;
    }
  }
  await ctx.audit({ action: "content.created", entityType: "content_entry", entityId: id, summary: `Drafted ${label(input.type)} “${input.title}”` });
  return getEntry(ctx, id);
}

/** Owners and admins may change what is live; members may change drafts only. */
function assertCanEdit(user: SessionUser, entry: Entry): void {
  if (entry.status === "archived") throw badRequest(`Restore the ${label(entry.type)} before editing it.`);
  if (entry.status === "published" && !roleAtLeast(user.role, "admin")) {
    throw forbidden(`Only owners and admins can change a ${entry.state === "scheduled" ? "scheduled" : "published"} ${label(entry.type)}.`);
  }
}

const FIELD_COLUMNS: Record<keyof EntryPatch, string> = {
  title: "title", slug: "slug", summary: "summary", body: "body", imageUrl: "image_url", imageAlt: "image_alt", menuOrder: "menu_order",
};

/** Changes only the given fields. The address (slug) can change only while the entry is a draft. */
export async function updateEntry(ctx: ModuleContext, id: string, raw: EntryPatch): Promise<Entry> {
  const user = ctx.requireRole("member");
  const patch = entryPatchSchema.parse(raw);
  const before = await getEntry(ctx, id);
  assertCanEdit(user, before);
  assertMenuAllowed(before.type, patch.menuOrder);
  if (patch.slug !== undefined && patch.slug !== before.slug) {
    if (before.status !== "draft") throw slugError(`The address of a ${before.state} ${label(before.type)} cannot change. Unpublish it first.`);
    await assertSlugUsable(ctx, before.type, patch.slug, id);
  }

  const sets: string[] = [];
  const params: SqlValue[] = [];
  const changed: string[] = [];
  for (const [field, value] of Object.entries(patch) as Array<[keyof EntryPatch, string | number | null | undefined]>) {
    if (value === undefined || before[field] === value) continue;
    sets.push(`${FIELD_COLUMNS[field]} = ?`);
    params.push(value);
    changed.push(field);
  }
  if (!sets.length) return before;
  try {
    await ctx.db.run(`UPDATE content_entries SET ${sets.join(", ")}, updated_by = ?, updated_at = ${NOW} WHERE id = ?`, [...params, user.id, id]);
  } catch (error) {
    if (isSlugUniqueError(error)) throw slugError(`${entryPath(before.type, patch.slug ?? before.slug)} is already used. Choose another address.`);
    throw error;
  }
  await ctx.audit({ action: "content.updated", entityType: "content_entry", entityId: id, summary: `Edited ${label(before.type)} “${patch.title ?? before.title}”: ${changed.join(", ")}`, data: { changed } });
  return getEntry(ctx, id);
}

/**
 * Publishes now, or at `publishAt` (a future time schedules it, a past time
 * backdates it). Owners and admins only.
 */
export async function publishEntry(ctx: ModuleContext, id: string, raw: PublishInput = {}): Promise<Entry> {
  const user = ctx.requireRole("admin");
  const input = publishInputSchema.parse(raw);
  const entry = await getEntry(ctx, id);
  if (entry.status === "archived") throw badRequest(`Restore the ${label(entry.type)} before publishing it.`);
  if (!entry.body.trim()) throw badRequest(`Write the ${label(entry.type)} text before publishing it.`, { body: "Write the text before publishing." });
  const publishedAt = input.publishAt ? new Date(input.publishAt).toISOString() : nowIso();
  await ctx.db.run(`UPDATE content_entries SET status = 'published', published_at = ?, updated_by = ?, updated_at = ${NOW} WHERE id = ?`, [publishedAt, user.id, id]);
  const scheduled = publishedAt > nowIso();
  await ctx.audit({
    action: scheduled ? "content.scheduled" : "content.published",
    entityType: "content_entry",
    entityId: id,
    summary: `${scheduled ? "Scheduled" : "Published"} ${label(entry.type)} ${entry.path}${scheduled ? ` for ${publishedAt}` : ""}`,
  });
  await ctx.emit("content.published", { entryId: id, type: entry.type, path: entry.path, publishedAt });
  return getEntry(ctx, id);
}

/** Takes a published or scheduled entry off the website; it becomes a draft again. */
export async function unpublishEntry(ctx: ModuleContext, id: string): Promise<Entry> {
  const user = ctx.requireRole("admin");
  const entry = await getEntry(ctx, id);
  if (entry.status !== "published") return entry;
  await ctx.db.run(`UPDATE content_entries SET status = 'draft', published_at = NULL, updated_by = ?, updated_at = ${NOW} WHERE id = ?`, [user.id, id]);
  await ctx.audit({ action: "content.unpublished", entityType: "content_entry", entityId: id, summary: `Unpublished ${label(entry.type)} ${entry.path}` });
  return getEntry(ctx, id);
}

/** Hides an entry from lists and the website. Members may archive drafts; live entries need an admin. */
export async function archiveEntry(ctx: ModuleContext, id: string): Promise<Entry> {
  const user = ctx.requireRole("member");
  const entry = await getEntry(ctx, id);
  if (entry.status === "archived") return entry;
  if (entry.status === "published" && !roleAtLeast(user.role, "admin")) throw forbidden(`Only owners and admins can archive a ${entry.state} ${label(entry.type)}.`);
  await ctx.db.run(`UPDATE content_entries SET status = 'archived', published_at = NULL, updated_by = ?, updated_at = ${NOW} WHERE id = ?`, [user.id, id]);
  await ctx.audit({ action: "content.archived", entityType: "content_entry", entityId: id, summary: `Archived ${label(entry.type)} “${entry.title}”` });
  return getEntry(ctx, id);
}

/** Brings an archived entry back as a draft. */
export async function restoreEntry(ctx: ModuleContext, id: string): Promise<Entry> {
  const user = ctx.requireRole("member");
  const entry = await getEntry(ctx, id);
  if (entry.status !== "archived") return entry;
  await ctx.db.run(`UPDATE content_entries SET status = 'draft', updated_by = ?, updated_at = ${NOW} WHERE id = ?`, [user.id, id]);
  await ctx.audit({ action: "content.restored", entityType: "content_entry", entityId: id, summary: `Restored ${label(entry.type)} “${entry.title}” as a draft` });
  return getEntry(ctx, id);
}

// Public site (no sign-in; only live entries)

export async function getLiveEntry(ctx: ModuleContext, type: EntryType, slug: string): Promise<Entry | null> {
  const row = await ctx.db.first<Row & { body: string }>(`SELECT ${SUMMARY_COLUMNS}, e.body FROM ${FROM} WHERE e.type = ? AND e.slug = ? AND ${live("e.")}`, [type, slug]);
  return row ? toEntry(row) : null;
}

export interface LivePost extends EntrySummary {
  /** The summary, or the start of the text when there is none. */
  teaser: string;
}

/** Live posts, newest first, for the blog page and the feed. */
export async function listLivePosts(ctx: ModuleContext, options: { limit: number; offset: number }): Promise<Page<LivePost>> {
  const [rows, total] = await Promise.all([
    ctx.db.all<Row & { bodyStart: string }>(
      `SELECT ${SUMMARY_COLUMNS}, substr(e.body, 1, 1200) AS bodyStart FROM ${FROM} WHERE e.type = 'post' AND ${live("e.")} ORDER BY e.published_at DESC, e.id DESC LIMIT ? OFFSET ?`,
      [options.limit, options.offset],
    ),
    ctx.db.value<number>(`SELECT COUNT(*) FROM content_entries WHERE type = 'post' AND ${live()}`),
  ]);
  return {
    items: rows.map(({ bodyStart, ...row }) => ({ ...toEntry(row), teaser: row.summary || excerpt(markdownText(bodyStart), 200) })),
    total: total ?? 0,
  };
}

/** Header links: live pages with a menu position (not the home page, which is "Home"), then "Blog" once a post is live. */
export async function siteMenu(ctx: ModuleContext): Promise<SiteLink[]> {
  const [pages, hasPosts] = await Promise.all([
    ctx.db.all<{ id: string; title: string; slug: string }>(`SELECT id, title, slug FROM content_entries WHERE type = 'page' AND slug <> '${HOME_SLUG}' AND menu_order IS NOT NULL AND ${live()} ORDER BY menu_order, title COLLATE NOCASE`),
    ctx.db.value<number>(`SELECT EXISTS (SELECT 1 FROM content_entries WHERE type = 'post' AND ${live()})`),
  ]);
  // Public demo: pages visitors publish never join the site menu.
  const menuPages = pages.filter((page) => !isDemoVisitorRecord(ctx.env, page.id));
  return [...menuPages.map((page) => ({ label: page.title, href: entryPath("page", page.slug) })), ...(hasPosts ? [{ label: "Blog", href: "/blog" }] : [])];
}

export async function sitemapEntries(ctx: ModuleContext): Promise<SitemapEntry[]> {
  const all = await ctx.db.all<{ id: string; type: EntryType; slug: string; updatedAt: string; publishedAt: string }>(
    `SELECT id, type, slug, updated_at AS updatedAt, published_at AS publishedAt FROM content_entries WHERE ${live()} ORDER BY type, published_at DESC`,
  );
  // Public demo: what visitors publish is noindex and stays out of the sitemap.
  const rows = all.filter((row) => !isDemoVisitorRecord(ctx.env, row.id));
  const posts = rows.filter((row) => row.type === "post");
  const latest = posts.reduce((max, post) => (post.publishedAt > max ? post.publishedAt : max), "");
  return [
    // The home page is "/", which the core sitemap already lists.
    ...rows.filter((row) => row.type === "page" && row.slug !== HOME_SLUG).map((row) => ({ path: entryPath("page", row.slug), lastmod: row.updatedAt, changefreq: "monthly" as const, priority: 0.7 })),
    ...(posts.length ? [{ path: "/blog", lastmod: latest, changefreq: "weekly" as const, priority: 0.6 }] : []),
    ...posts.map((row) => ({ path: entryPath("post", row.slug), lastmod: row.updatedAt > row.publishedAt ? row.updatedAt : row.publishedAt, changefreq: "monthly" as const, priority: 0.5 })),
  ];
}

// Dashboard helpers

export async function searchEntries(ctx: ModuleContext, term: string): Promise<SearchResult[]> {
  ctx.requireRole("member");
  const rows = await ctx.db.all<{ id: string; type: EntryType; slug: string; title: string; status: EntryStatus; publishedAt: string | null }>(
    "SELECT id, type, slug, title, status, published_at AS publishedAt FROM content_entries WHERE status <> 'archived' AND (title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 8",
    [likePattern(term), likePattern(term)],
  );
  return rows.map((row) => ({ module: "content", type: row.type, id: row.id, title: row.title, subtitle: `${capitalised(row.type)} · ${entryPath(row.type, row.slug)} · ${entryState(row)}`, href: `/app/content/${row.id}` }));
}

export async function publishingSummary(ctx: ModuleContext): Promise<{ published30d: number; drafts: number; scheduled: number }> {
  const row = await ctx.db.first<{ published30d: number; drafts: number; scheduled: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'published' AND published_at <= ${NOW} AND published_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days') THEN 1 ELSE 0 END), 0) AS published30d,
       COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS drafts,
       COALESCE(SUM(CASE WHEN status = 'published' AND published_at > ${NOW} THEN 1 ELSE 0 END), 0) AS scheduled
     FROM content_entries`,
  );
  return row ?? { published30d: 0, drafts: 0, scheduled: 0 };
}

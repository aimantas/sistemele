import { z } from "zod";
import { SLUG_PATTERN } from "@/shared/slug";

/**
 * Content shapes shared by the API, MCP tools, the public site and the
 * dashboard. An entry is a page (served at /<slug>) or a post (served at
 * /blog/<slug>). Bodies are Markdown; see `./markdown.tsx` for what renders.
 */

export const ENTRY_TYPES = ["page", "post"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** Stored status. A published entry whose `publishedAt` is in the future is scheduled. */
export const ENTRY_STATUSES = ["draft", "published", "archived"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** What people see in the dashboard: stored status plus "scheduled". */
export const ENTRY_STATES = ["draft", "scheduled", "published", "archived"] as const;
export type EntryState = (typeof ENTRY_STATES)[number];

export const ENTRY_STATE_LABELS: Record<EntryState, string> = { draft: "Draft", scheduled: "Scheduled", published: "Published", archived: "Archived" };
export const ENTRY_TYPE_LABELS: Record<EntryType, { one: string; many: string }> = { page: { one: "page", many: "pages" }, post: { one: "post", many: "posts" } };

/**
 * First path segments a page may not use, because the system or another
 * module serves them. Pages live at /<slug>, so "/products" or "/app" would
 * otherwise be shadowed or shadow something.
 */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  "api", "app", "assets", "blog", "brand", "contact", "favicon", "feed", "health", "i", "llms", "login", "mcp", "privacy", "products", "q", "robots", "search", "sitemap", "static",
];

export function entryState(entry: { status: EntryStatus; publishedAt: string | null }, now = new Date().toISOString()): EntryState {
  if (entry.status === "published" && entry.publishedAt && entry.publishedAt > now) return "scheduled";
  return entry.status;
}

/**
 * The page with this address is the home page: its title and summary replace
 * the default headline at "/", its text appears below them, and /home
 * redirects to "/".
 */
export const HOME_SLUG = "home";

/** Public path of an entry: "/about" for a page, "/" for the home page, "/blog/first-post" for a post. */
export function entryPath(type: EntryType, slug: string): string {
  if (type === "post") return `/blog/${slug}`;
  return slug === HOME_SLUG ? "/" : `/${slug}`;
}

const text = (max: number) => z.string().trim().max(max);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an address, e.g. about-us.")
  .max(80, "Keep the address under 80 characters.")
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens, e.g. about-us.");

/** Image shown with the entry and in link previews: an https:// address or a path on this site. */
const imageUrl = text(500).refine((value) => value === "" || /^https:\/\/\S+$/iu.test(value) || /^\/(?!\/)\S*$/u.test(value), "Use a full https:// address or leave it empty.");

/** Field rules without defaults, so a PATCH never resets fields it did not send. */
const entryFields = {
  title: text(200).min(1, "Enter a title."),
  slug,
  summary: text(300),
  body: z.string().max(100_000, "Keep the text under 100,000 characters."),
  imageUrl,
  imageAlt: text(200),
  /** Pages only: position in the public site menu (1 = first); null keeps it out of the menu. */
  menuOrder: z.number().int("Use a whole number.").min(1, "Use 1 to 99.").max(99, "Use 1 to 99.").nullable(),
};

export const entryInputSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  title: entryFields.title,
  /** Defaults to one made from the title; a number is added when it is taken. */
  slug: entryFields.slug.optional(),
  summary: entryFields.summary.default(""),
  body: entryFields.body.default(""),
  imageUrl: entryFields.imageUrl.default(""),
  imageAlt: entryFields.imageAlt.default(""),
  menuOrder: entryFields.menuOrder.default(null),
});
export type EntryInput = z.input<typeof entryInputSchema>;

export const entryPatchSchema = z.object(entryFields).partial();
export type EntryPatch = z.input<typeof entryPatchSchema>;

export const publishInputSchema = z.object({
  /** When it goes live. Omit for now; a future time schedules it; a past time backdates it. */
  publishAt: z.iso.datetime({ offset: true, message: "Enter a date and time." }).optional(),
});
export type PublishInput = z.input<typeof publishInputSchema>;

export const entryListQuerySchema = z.object({
  type: z.enum(ENTRY_TYPES).optional(),
  /** Omit for everything except archived entries. */
  state: z.enum(ENTRY_STATES).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});
export type EntryListQuery = z.infer<typeof entryListQuerySchema>;

export interface EntrySummary {
  id: string;
  type: EntryType;
  slug: string;
  /** Public path, e.g. "/about" or "/blog/first-post". Live only when `state` is "published". */
  path: string;
  title: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
  menuOrder: number | null;
  status: EntryStatus;
  state: EntryState;
  publishedAt: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Entry extends EntrySummary {
  /** Markdown. */
  body: string;
}

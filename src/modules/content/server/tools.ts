import { z } from "zod";
import { defineTool } from "@/modules/types.server";
import { ENTRY_STATES, ENTRY_TYPES, entryInputSchema, entryPatchSchema, publishInputSchema } from "../shared/schema";
import * as content from "./service";

const REF = z.string().min(1).describe("Entry id (cnt_…) or its public path, e.g. /about or /blog/first-post");
const MARKDOWN_NOTE =
  "`body` is Markdown: ## headings, paragraphs, **bold**, *italic*, [links](https://…), ![images](https://…), lists, > quotes and ``` code. Raw HTML is shown as text. The title is the page's heading, so start the body with text or ##.";

/** Content tools for AI agents (MCP). Each wraps a service function. */
export const contentTools = [
  defineTool({
    name: "content_list_entries",
    title: "List pages and posts",
    description:
      "Lists website pages and blog posts, most recently edited first. Filter by `type` (page or post), `state` (draft, scheduled, published, archived; default: everything except archived) or `query` (title or address). Returns { items, total }; items have no body — use content_get_entry for the text. Each item's `path` is its public address.",
    input: z.object({
      type: z.enum(ENTRY_TYPES).optional(),
      state: z.enum(ENTRY_STATES).optional(),
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
    readOnly: true,
    run: ({ query, ...rest }, ctx) => content.listEntries(ctx, { q: query, ...rest }),
  }),
  defineTool({
    name: "content_get_entry",
    title: "Get page or post",
    description: "Returns one page or post with its Markdown `body`, by id or public path. `state` says whether it is live (published), scheduled, a draft or archived.",
    input: z.object({ entry: REF }),
    readOnly: true,
    run: ({ entry }, ctx) => content.getEntryByRef(ctx, entry),
  }),
  defineTool({
    name: "content_create_entry",
    title: "Draft page or post",
    description: `Creates a page (served at /<slug>) or a blog post (served at /blog/<slug>) as a draft. Drafts are never public; an owner or admin publishes them (content_publish_entry). Check content_list_entries first to avoid duplicates. \`slug\` defaults to one made from the title. \`summary\` (up to 300 characters) is shown in post lists and search results. \`menuOrder\` (pages only, 1–99) places the page in the site menu. Write only facts you were given: no invented prices, reviews, delivery times or claims. ${MARKDOWN_NOTE}`,
    input: entryInputSchema,
    run: (input, ctx) => content.createEntry(ctx, input),
  }),
  defineTool({
    name: "content_update_entry",
    title: "Edit page or post",
    description: `Changes only the given fields of a page or post. Members may edit drafts; changing a published or scheduled entry needs an owner or admin. The address (slug) can change only while it is a draft. ${MARKDOWN_NOTE}`,
    input: z.object({ entry: REF, changes: entryPatchSchema }),
    run: async ({ entry, changes }, ctx) => content.updateEntry(ctx, (await content.getEntryByRef(ctx, entry)).id, changes),
  }),
  defineTool({
    name: "content_publish_entry",
    title: "Publish page or post",
    description:
      "Puts a page or post on the website now, or at `publishAt` (ISO date-time; a future time schedules it, a past one backdates a post). Owners and admins only. The text must not be empty. Returns the entry; its `path` is the live address.",
    input: z.object({ entry: REF, ...publishInputSchema.shape }),
    minRole: "admin",
    run: async ({ entry, publishAt }, ctx) => content.publishEntry(ctx, (await content.getEntryByRef(ctx, entry)).id, { publishAt }),
  }),
  defineTool({
    name: "content_unpublish_entry",
    title: "Unpublish page or post",
    description: "Takes a published or scheduled page or post off the website. It becomes a draft again; its address stops working until it is published again. Owners and admins only.",
    input: z.object({ entry: REF }),
    minRole: "admin",
    run: async ({ entry }, ctx) => content.unpublishEntry(ctx, (await content.getEntryByRef(ctx, entry)).id),
  }),
];

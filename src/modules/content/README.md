# Content module

Website pages (served at `/<slug>`) and blog posts (served at `/blog/<slug>`),
written in Markdown in the dashboard (Website → Pages, Posts) or by an agent
over MCP. Anyone on the team drafts; owners and admins publish, schedule and
change what is live. No other module depends on it.

- Server: `server/index.ts` (module definition), `service.ts` (all rules), `routes.ts`, `tools.ts`, `site.tsx` (public pages, blog, RSS)
- Shared: `shared/schema.ts` (Zod schemas, types, states, reserved addresses), `shared/markdown.tsx` (safe Markdown → React, plain text, excerpts)
- Client: `client/index.tsx` (nav, routes, widget, quick actions), `api.ts`, `EntriesPage.tsx` (Pages and Posts lists), `EntryEditorPage.tsx`, `widgets.tsx`
- Developer panel (dev mode): `client/dev.ts` lists each page's files, MCP tools and starter prompts for a coding agent; `tests/dev-panel.test.ts` checks it.
- Migration: `migrations/0006_content.sql` · Seed: `seed/06_content.sql` · Tests: `tests/content.test.ts`, `tests/markdown.test.ts`

## Rules

- **Who may do what.** Members create entries (always drafts) and edit drafts. Owners and admins publish, schedule, unpublish, archive live entries and edit published or scheduled ones. An API token with the member role can therefore draft but never publish: agents write, people decide what goes live.
- **States.** Stored `status` is `draft`, `published` or `archived`. An entry is **live** when `status = 'published'` and `published_at <= now`. A future `published_at` is **scheduled**: it goes live by itself, with no background job. The API returns both `status` and the derived `state` (`draft`, `scheduled`, `published`, `archived`).
- **Publishing** needs text in the body. `publishAt` is optional: omitted = now, future = scheduled, past = backdated (for importing older posts). Unpublishing and archiving clear `published_at`; restoring an archived entry makes it a draft.
- **Addresses.** The slug is made from the title on creation (lowercase ASCII, accents removed, `-2`, `-3` … on clashes) and is unique per type, so `/about` and `/blog/about` can both exist. It can change only while the entry is a draft, so live links never break silently. Pages may not use system addresses (`RESERVED_PAGE_SLUGS`: `api`, `app`, `blog`, `products`, `contact`, …); a page titled “Products” gets `products-2`.
- **Markdown is rendered safely** (`shared/markdown.tsx`): parsed into a small tree and rendered as React elements, never `dangerouslySetInnerHTML`. HTML in the source is shown as text. Links allow `http`, `https`, `mailto`, `tel` and paths on the site; images allow `https://` and site paths. Parsing is linear on hostile input. The same renderer draws the editor preview, so the preview matches the website.
- **Home page.** The page with the address `home` (`HOME_SLUG`) is the home page: while it is live, its title and summary replace the default headline at `/` (from `src/worker/site/content.ts`), its text appears below them, and `/home` redirects to `/`. Its `path` is `/`. Pages → **Home page** opens it, creating the draft the first time.
- **Menu.** A page with `menuOrder` (1–99) appears in the public header while it is live, after the fixed module links and before the call to action; “Blog” appears once a post is live. Posts cannot be in the menu.
- Every write is validated with Zod, role-checked and audited (`content.created`, `content.updated`, `content.published`, `content.scheduled`, `content.unpublished`, `content.archived`, `content.restored`).

## Table

| Table | Purpose |
| --- | --- |
| `content_entries` | `type` (page, post), `slug` (unique per type), `title`, `summary` (≤ 300, for lists, link previews and the meta description), `body` (Markdown, ≤ 100,000), `image_url`/`image_alt`, `menu_order` (pages; NULL = not in the menu), `status`, `published_at`, `created_by`, `updated_by`, timestamps. |

## API (`/api/content`, signed in)

| Method and path | Role | What |
| --- | --- | --- |
| `GET /entries?type=page\|post&state=draft\|scheduled\|published\|archived&q=&limit=&offset=` | member | `{ items: EntrySummary[], total }`, most recently edited first; without `state`, everything but archived. Items have no body. |
| `POST /entries` | member | `{ type, title, slug?, summary?, body?, imageUrl?, imageAlt?, menuOrder? }` → the draft (201). |
| `GET /entries/:id` | member | The entry with its Markdown `body`. |
| `PATCH /entries/:id` | member for drafts, admin for live | Changes only the fields sent. |
| `POST /entries/:id/publish` | admin | `{ publishAt? }` (ISO date-time with offset). |
| `POST /entries/:id/unpublish` | admin | Back to draft. |
| `POST /entries/:id/archive` | member for drafts, admin for live | Hides it. |
| `POST /entries/:id/restore` | member | Archived → draft. |

## MCP tools

`content_list_entries`, `content_get_entry`, `content_create_entry`, `content_update_entry` (member);
`content_publish_entry`, `content_unpublish_entry` (admin). Tools that take `entry` accept an id
(`cnt_…`) or the public path (`/about`, `/blog/first-post`).

## Metrics and widgets

| Key / type | What |
| --- | --- |
| `content.published_30d` (number) | Entries that went live in the last 30 days; hint “N drafts · N scheduled”. |
| `content.recent` (widget, 2 × 1) | Most recently edited pages and posts with their state. |

Quick actions: New post, New page. Global search finds entries by title or address.

## Events

| Event | When |
| --- | --- |
| `content.published` (emitted) | After publish or schedule. Payload `{ entryId, type, path, publishedAt }`; `publishedAt` may be in the future. Use it for webhooks or cache purges. |

## Public website

- `GET /` — the core home page. `home()` supplies the hero from the live home page and two sections: the home page text and **From the blog** (the three newest live posts). With neither, the default copy and “How it works” show.
- `GET /:slug` — a live page (`/home` redirects to `/`). Unknown, reserved or non-lowercase addresses fall through to the next route (static files, then the 404 page), so the catch-all never hides other modules' pages.
- `GET /blog` — live posts, newest first, 20 per page (`?page=2`; `?page=1` redirects to `/blog`). `noindex` while there are no posts.
- `GET /blog/:slug` — a live post: date, optional image, body. JSON-LD `BlogPosting` (headline, dates, description, image, publisher = the business) and `BreadcrumbList`; `article:published_time`/`modified_time`.
- `GET /blog/feed.xml` — RSS 2.0 with the latest 20 posts, linked from blog pages with `<link rel="alternate">`.
- Every page answers `Accept: text/markdown` with its Markdown source. The meta description is the summary, else the first 155 characters of the text.
- `sitemap()` adds live pages (except the home page, listed as `/` by the core), `/blog` and live posts. `siteMenu()` supplies the header links.

## Dashboard screens

- `/app/content/pages`, `/app/content/posts` — search and status filter; **Home page** (pages); New page / New post (also `?new=1` and the quick actions) asks for the title and opens the editor.
- `/app/content/:id` — editor: title, Markdown text with Write/Preview, summary; Publishing (publish now, schedule, unpublish — admins); Address with a search-result preview; Site menu (pages); Image. Members see “An owner or admin publishes it”; live entries are read-only for them.

## Extending

- **New field:** add a column in a new migration, the field in `entryFields` (`shared/schema.ts`), `SUMMARY_COLUMNS` and `FIELD_COLUMNS` in `service.ts`, the INSERT in `createEntry`, then the editor (`client/EntryEditorPage.tsx`).
- **Markdown feature (e.g. tables):** extend the block parser and `renderBlocks` in `shared/markdown.tsx`, add cases to `tests/markdown.test.ts`, and keep output as React elements.
- **Image uploads:** belong to a files module (R2, see the roadmap); until then `imageUrl` takes an `https://` address or a site path.
- **Webhooks or cache purges on publish:** handle `content.published` in another module's `events`.

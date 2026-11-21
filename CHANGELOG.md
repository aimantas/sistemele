# Changelog

## Unreleased

- Starter home: every screenshot opens full size in a lightbox (the browser's popover; no JavaScript, Esc or a click outside closes it), and a "More screens" gallery adds quotes, products, the website editor, brand settings, developer mode and the docs. The "Works with" strip sits in the first viewport. Settings → Brand shows a square logo at a sensible size.

- Security review fixes (details and accepted limits in `docs/security.md`, regression tests in `tests/security.test.ts`):
  - Deployed Workers never log email bodies (sign-in and document links); subjects lose control characters.
  - Sign-in answers equally fast for known and unknown addresses; IPv6 rate limits by /64; rate-limit and sign-in token tables are pruned.
  - An invalid `Authorization` header never falls back to the session cookie, and only valid API tokens skip the CSRF check. MCP batches are capped at 20; email sending is capped per person and for automatic emails.
  - Demo mode needs `APP_ENV=demo`; the hourly reset only wipes a database that holds demo data. In the demo, settings are read-only, visitor-published pages, posts and products are noindex, off the sitemap, menu and home page with `nofollow ugc` links, and the contact form says messages are public.
  - Invoice issue dates must be in date order (not future, not over 31 days back, not before the last issued invoice). Document totals are capped to safe integers.
  - Only owners and admins can change what a public product shows. The contact form no longer returns a lead id. Activity, task and name changes are audited. The last-owner rule is atomic. SVG logos with namespaced elements, encoded attributes, `@import` or CDATA are refused. Sign-in only redirects inside `/app`.
  - Deployed copies without `APP_URL` always build https links. `npm run setup` writes `.dev.vars` readable by you only. Patched `undici` and `sharp` under the test-only `miniflare` (npm audit: 0).

- Developer mode in the admin panel: a switch in the sidebar (owners and admins, or `?dev=1`) shows a developer panel on every page with ready-to-copy briefs for a coding agent, a box that turns your own feedback into a brief or a prefilled GitHub issue, the files behind the page and its MCP tools. Notes live in each module's `client/dev.ts` (scaffolded by `npm run module:new`) and `src/app/dev/core-pages.ts`; `tests/dev-panel.test.ts` keeps them in step with routes, files and tools. `REPOSITORY_URL` in `src/shared/project.ts` sets the repository the links point to.

- New Sistemėlė mark: a wheel of six modules around a hub on the brand tile, one module tinted. It is the favicon and the demo logo; brand rules (clear space, sizes, do's and don'ts) are on `/app/design#brand`, in DESIGN.md and `docs/design-system.md`. Square logos from Settings → Brand are now treated as marks: the header, admin panel, sign-in page and quotes and invoices set the business name beside them in Inter (`logoIsMark`, `BrandLockup`).
- Light by default. The public site is always light; the admin panel gets a dark mode switch (sidebar footer and `/app/design`) that sets the shadcn `.dark` class and is remembered per browser. Nothing follows `prefers-color-scheme` any more; the dark screenshots are gone.
- "Edit this page" on the public demo and in local development: a card at the end of each public page with the admin screen that edits it, the repository files behind it and how the site is organised, linked to GitHub. Never shown on a live site.

- Docs at `/docs`: AGENTS.md, the agent skill and its references, DESIGN.md and every guide in `docs/`, rendered from the repository with a sidebar, "On this page", previous/next and links to the source. The overview shows how the pieces fit (architecture diagram, the write path, module anatomy, the agent loop), the non-negotiables read from AGENTS.md, and a chart of MCP tools per module counted from the running code. Agents get the original Markdown with `Accept: text/markdown`; the pages are in the sitemap and llms.txt. `site.docs` in `sistemele.config.ts` turns it off; "docs" is now a reserved page address.

- Design system: the admin panel and public site move to shadcn/ui tokens and components (`src/app/ui`, `components.json`, `cn()` in `src/lib/utils.ts`), Inter Variable (self-hosted) and a cool neutral palette, with light and dark modes from the system setting. Settings → Brand now overrides the shadcn tokens in both modes (a lighter brand colour is derived for dark), and the default surface is "cool". New `/app/design` page shows every token and component; new `docs/design-system.md`; `DESIGN.md` rewritten; `tests/tokens.test.ts` keeps the site's token copy equal to the panel's. Button variants are now shadcn names (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`); `buttonClass` became `buttonVariants`.
- Starter home redesigned: large headline over the live dashboard, "Works with" logo strip, four-step get started, feature rows with light and dark screenshots, module index with MCP tool counts, agent section, deploy call to action; blog posts show as ruled rows; the mobile header keeps the menu on one scrolling line. The demo logo's wordmark follows dark mode.

- The public demo at sistemele.aimantas.com is the package's landing page: it carries the Sistemėlė name and logo, an About page about the project, and may be indexed. The starter home shows brand logos (Cloudflare, MCP, GitHub, Claude, OpenAI, Cursor, Resend) from Simple Icons (CC0) in `public/logos`, served as static files. New `ALLOW_INDEXING=1` setting lets search engines index public pages outside production; the dashboard, API and private links stay `noindex`.
- Positioning: "Don't ask your agent to reinvent the wheel" — a practical starter kit and admin panel for AI-native projects. README, PRODUCT, AGENTS, the skill and the website (`website/`) lead with it; new `docs/extending.md` with best practices for extending.
- CRM leads inbox: website messages arrive as leads (new → contacted → qualified, or disqualified with a reason), with owners, sources, estimated values and follow-up dates; logging a call, email or meeting marks a new lead contacted; one-step conversion into a contact (reused by email) and a deal, moving the timeline along. Filters by status, owner, source and due follow-ups; dashboard widget; metrics for open leads, new leads and lead conversion; MCP tools `crm_list_leads`, `crm_get_lead`, `crm_create_lead`, `crm_update_lead`, `crm_convert_lead`.
- CRM pipeline stages are configurable (Pipeline → Stages): add, rename, reorder and remove open stages, win probability per stage, weighted pipeline metric. Deals gain owners and lost reasons; dropping a deal on Lost asks why; a deal dialog edits title, value, close date, owner and stage. MCP tools `crm_list_stages`, `crm_create_stage`, `crm_update_stage`, `crm_update_deal`.
- Migration `0007_crm_leads_stages.sql`: deals in the retired "lead" stage move to "qualified"; default stages Qualified, Proposal, Negotiation, Won, Lost.
- Core: `GET /api/team` and the `core_list_team` tool list active users for owner pickers; `assertTeamMember` helper.
- Public site: until a page with the address `home` is published, `/` is a general-purpose starter home (motto, get-started guide that adapts to demo mode, the enabled modules, latest posts, "Run your own" with Deploy to Cloudflare); the demo seed no longer has a home page. The starter home shows real admin-panel screenshots (`public/screenshots`, served without the Worker), icons, a "Built for agents" section and a Cloudflare deploy section. A published home page shows its hero with actions for the contact form and every module's public section; the contact page and header link are "Contact" instead of "Request a quote"; no reply-time promise in default copy. The demo home page explains the demo.

- Content module: website pages (`/<slug>`) and blog posts (`/blog/<slug>`) in Markdown, with drafts, scheduling, unpublish/archive, a site-menu position, RSS feed, `BlogPosting` structured data, sitemap entries, a dashboard editor with preview, a widget, a KPI metric and MCP tools. Members draft; owners and admins publish.
- Starter home page: modules contribute a hero and sections through `home()`; a live content page with the address `home` replaces the default headline, and the newest posts show under “From the blog”. Demo data includes a home page, an About page and posts.
- Demo mode (`DEMO_MODE=1`): one-click sign-in as a shared demo owner, no email ever sent, demo banners, noindex, and a Cron Trigger that empties every table and reloads the seed data. The public demo runs at https://sistemele.aimantas.com (`npm run deploy:demo`).
- Non-production deployments (`APP_ENV` other than `production`) send `X-Robots-Tag: noindex, nofollow`.
- Safe Markdown renderer (`src/modules/content/shared/markdown.tsx`): no raw HTML, allow-listed link schemes, linear parsing.
- Core: `siteMenu` hook for data-driven header links; `PageMeta` article dates and alternate links; `slugify` moved to `src/shared/slug.ts`; `CheckboxField` moved to the UI kit.

## 0.1.0 — 2026-11-18

First public version.

- Core: Hono Worker, D1 migrations, magic-link sign-in, roles, API tokens, audit log, email via Resend with delivery log, security headers, CSRF guard, rate limits.
- Modules: CRM, Catalog & stock, Quotes, Invoices — with REST API, MCP tools, KPI metrics, dashboard widgets, events and tests.
- Dashboard: drag-and-drop cards, per-user layouts, templates, command palette.
- Brand settings: SVG logo without file uploads (sanitised, sandboxed), colour presets and custom colour with contrast check, background and corner styles; applied to dashboard, public site and documents.
- Public site: server-rendered pages, SEO metadata, JSON-LD, sitemap, robots, llms.txt, Markdown negotiation.
- Agent tooling: AGENTS.md, module READMEs, installable skill, Claude Code commands.

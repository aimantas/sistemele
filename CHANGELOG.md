# Changelog

## Unreleased

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

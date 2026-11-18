# Changelog

## Unreleased

- Content module: website pages (`/<slug>`) and blog posts (`/blog/<slug>`) in Markdown, with drafts, scheduling, unpublish/archive, a site-menu position, RSS feed, `BlogPosting` structured data, sitemap entries, a dashboard editor with preview, a widget, a KPI metric and MCP tools. Members draft; owners and admins publish.
- Starter home page: modules contribute a hero and sections through `home()`; a live content page with the address `home` replaces the default headline, and the newest posts show under “From the blog”. Demo data includes a home page, an About page and posts.
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

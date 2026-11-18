---
name: sistemele
description: Build, extend and operate Sistemėlė business systems on Cloudflare Workers (Hono + D1 + React dashboard + MCP). Use when creating a new Sistemėlė project, adding or changing a module (CRM, catalog/stock, quotes, invoices, content pages/blog, or a new one such as bookings), adding dashboard widgets, KPI metrics, dashboard templates, MCP tools, public SEO pages or emails, deploying to Cloudflare, or connecting an AI agent to a running installation over MCP.
---

# Sistemėlė

Sistemėlė is a modular business-system starter: one Cloudflare Worker serves a
JSON API, an MCP endpoint (`/mcp`), a server-rendered public site and a React
dashboard (`/app`); data in D1; email through Resend.

## First, orient

1. If you are inside a Sistemėlė repository (it has `sistemele.config.ts`), read `AGENTS.md` and the README of the module you will touch (`src/modules/<id>/README.md`). They override this skill where they differ.
2. Starting a new project instead:

   ```bash
   npx degit aimantas/sistemele <folder> && cd <folder>
   npm install && npm run setup && npm run dev   # http://localhost:5173/app, sign in as owner@example.com
   ```

3. Operating a running installation (no code changes): connect over MCP — see [references/mcp.md](references/mcp.md).

## Rules that are never optional

- Money = integer cents; VAT/discount = integer basis points (2100 = 21%). Use `src/shared/money.ts`.
- Server-authoritative totals, stock, numbering, statuses and permissions.
- Services take `ctx: ModuleContext`, validate with Zod, call `ctx.requireRole`, `ctx.audit` every write. Routes and MCP tools stay thin wrappers.
- Modules never import each other's server code; use typed events in `src/modules/events.ts`; handlers idempotent.
- Issued invoices are immutable; numbering gap-free via `gapFreeNumberStatements` in one `db.batch`.
- Migrations append-only (`migrations/NNNN_<id>.sql`). Never edit an applied one.
- No invented business facts (reviews, prices, stock, certifications) in copy, seeds or structured data.
- Local work uses the local D1. Remote D1 commands, secrets and `wrangler deploy` need explicit human approval.

## Task → recipe

| Task | Read |
| --- | --- |
| New module | [references/module.md](references/module.md) — or `npm run module:new <id> "<Name>"` then fill in |
| Dashboard widget, KPI metric, template | [references/dashboard.md](references/dashboard.md) |
| MCP tool | [references/mcp.md](references/mcp.md) |
| Public page / SEO | [references/seo.md](references/seo.md) |
| Email | `docs/email.md` in the repo (`renderEmail` + `ctx.sendEmail`) |
| Deploy | [references/deploy.md](references/deploy.md) |

## Done means

1. Works end to end (API + UI + MCP tool where it makes sense) with loading, empty and error states, phone and desktop.
2. `npm run check` (typecheck, lint, tests against a real D1) and `npm run build` pass; new behaviour has tests in `tests/`.
3. Module README and docs updated.
4. Report exactly what was verified and where (local / committed / pushed / deployed / verified on the deployed URL). Never claim a later state from an earlier one.

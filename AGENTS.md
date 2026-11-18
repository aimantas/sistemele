# Sistemėlė — agent instructions

Applies to the whole repository. Read this file first, then the README of the
module you touch (`src/modules/<id>/README.md`).

Sistemėlė is a modular business system on Cloudflare Workers: one Worker
serves the JSON API, an MCP endpoint, a server-rendered public website and a
React dashboard. Data lives in D1. Email goes through Resend.

## Non-negotiables

- **Money is integer cents. VAT and discounts are integer basis points** (2100 = 21%). Use `src/shared/money.ts`; never use floats for amounts.
- **The server is authoritative** for prices, totals, stock, numbering, statuses and permissions. Client totals are previews; APIs ignore them.
- **Modules never import each other's server code.** React to other modules through events (`src/modules/events.ts`). A module may import another module's `shared/` or `client/` code only if it lists it in `requires`.
- **Every write is validated (Zod), permission-checked (`ctx.requireRole`) and audited (`ctx.audit`).**
- **Invoices are immutable once issued.** Correct with void + new invoice. Numbers are gap-free (`gapFreeNumberStatements`).
- **Never invent business facts** in copy, seeds, structured data or emails: no fake reviews, prices, stock, delivery times, certifications or urgency.
- **Never mutate production from a local task.** `npm run dev` uses a local D1. Remote commands (`--remote`, `wrangler deploy`, `wrangler secret put`) need explicit human approval.
- **No secrets in the repo, logs, seeds, screenshots or memory.** Secrets go to `wrangler secret put`; local values to `.dev.vars` (git-ignored).

## Map

| Path | What |
| --- | --- |
| `sistemele.config.ts` | Enabled modules, locale, currency, business defaults. Start here. |
| `src/worker/app.ts` | Hono app: middleware order, route mounting, SPA and 404 handling. |
| `src/worker/context.ts` | `ModuleContext` (db, user, audit, emit, sendEmail, business, waitUntil). |
| `src/worker/auth/` | Magic-link sign-in, sessions, API tokens. |
| `src/worker/core/routes.ts` | Core API: me, team, settings, API tokens, audit, dashboard layout, metrics, search, email log. |
| `src/worker/mcp/` | MCP server (`POST /mcp`) and core tools. |
| `src/worker/site/` | Public SSR pages, SEO helpers, sitemap/robots/llms.txt, `DocumentView` for quotes/invoices, inline CSS. |
| `src/worker/email/` | `renderEmail` layout and `sendEmail` (Resend, logged to `email_log`). |
| `src/worker/lib/` | `Db`, errors, validation, crypto, rate limit, settings, sequences, Turnstile. |
| `src/modules/<id>/` | A module: `shared/` (Zod schemas, types), `server/` (service, routes, tools, index), `client/` (api hooks, pages, widgets, index), `README.md`. |
| `src/modules/server.ts`, `client.ts` | Module registries. |
| `src/modules/types.server.ts`, `types.client.ts`, `events.ts` | Module contracts. |
| `src/app/` | Dashboard SPA: shell, router, dashboard grid, settings, UI kit (`src/app/ui`). |
| `src/shared/` | Code used by browser and Worker: money, lines, ids, dates, auth roles, API shapes, branding tokens, `patchSchema`. |
| `migrations/` | D1 migrations, one per module, applied in filename order. |
| `seed/` | Local demo data (`npm run db:seed`). Fictional only. |
| `tests/` | Vitest against a real in-memory D1 with all migrations (`tests/helpers.ts`). |
| `docs/` | Guides: architecture, modules, dashboard, AI agents, deployment, email, SEO, security. |
| `skills/sistemele/` | Installable agent skill for this project. |
| `website/` | Marketing site for Sistemėlė itself (static, separate Worker). Delete it in your own project. |

## Commands

```bash
npm run setup          # .dev.vars, local migrations, demo data
npm run dev            # Vite + real Worker in workerd + local D1 at http://localhost:5173
npm run check          # typecheck + lint + tests
npm run build          # production build (client + Worker)
npm run db:migrate     # apply migrations to the LOCAL database
npm run db:reset       # wipe local D1, migrate, seed
npm run module:new <id> "<Name>"   # scaffold a module and register it
npm run doctor         # config and wiring checks
npm run deploy:demo    # the public demo (sistemele.aimantas.com); needs CLOUDFLARE_ACCOUNT_ID and approval
```

Sign in locally with an address in `ADMIN_EMAILS` (`.dev.vars`). Without `RESEND_API_KEY`
the sign-in page shows the link and the terminal prints every email.

## Recipes

Each recipe lists the files to touch. Follow the CRM module as the reference.

**Add a module** — `npm run module:new bookings "Bookings"`, then: write the migration in `migrations/`, Zod schemas in `shared/schema.ts`, services in `server/service.ts` (take `ctx: ModuleContext`), thin routes in `server/routes.ts`, tools in `server/tools.ts`, pages/widgets in `client/`, a `README.md`, a seed file and `tests/<id>.test.ts`. Details: `docs/modules.md`.

**Add an API endpoint** — add a service function (validate with Zod, `ctx.requireRole`, `ctx.audit` on writes), call it from `server/routes.ts`. Signed-in routes go in `api`; anonymous ones in `publicApi` (mounted at `/api/public/<id>`; validate and `enforceRateLimit`).

**Add an MCP tool** — `defineTool({ name: "<module>_<verb>_<noun>", title, description, input, readOnly?, minRole?, run })` in `server/tools.ts`, wrapping a service. Descriptions are for agents: what it does, when to use it, units.

**Add a dashboard widget** — component in `client/widgets.tsx`, then an entry in the module's `widgets` with a stable `type` (`<module>.<name>`), `defaultSize` and a `React.lazy` component. Recipe and prompts: `docs/dashboard.md`.

**Add a KPI metric** — entry in the server module's `metrics` (`key: "<module>.<name>"`, `format: number|money|percent`, `compute(ctx)`). It appears in Customize → Add card automatically.

**Add a dashboard template** — append to `src/app/dashboard/templates.ts`.

**React to another module** — add the event to `src/modules/events.ts` if new, `ctx.emit` it after the write, handle it in the other module's `events`. Handlers must be idempotent.

**Add a text page or blog post** — no code: create it in the content module (dashboard Website → Pages/Posts, or the `content_*` MCP tools). Members and member tokens draft; an owner or admin publishes.

**Add a public page in code** — a `site` Hono route that returns `renderPage(c, { meta, body, markdown })`. Unique title and description, canonical path, JSON-LD only for visible facts, `noindex` for private pages, add it to `sitemap()`. See `docs/seo.md`.

**Send an email** — `renderEmail({...})` then `ctx.sendEmail({ to, subject, template: "<module>.<event>", ...content })`. Use `ctx.waitUntil` when the response must not wait.

**Change the schema** — add a new numbered file in `migrations/` (never edit an applied migration), then `npm run db:migrate`. Keep conventions: TEXT ids with prefix, ISO timestamps, cents, bps.

## Conventions

- IDs: `newId("<prefix>")` → `ct_01jd…`. Prefixes: usr, ses, tok, ct, dl, act, prd, mv, qt, ql, inv, il, pay, aud, eml, cnt.
- API JSON is camelCase (alias columns in SQL: `company_name AS companyName`). Errors are `{ error: { code, message, issues? } }` via `AppError` helpers.
- PATCH schemas use `patchSchema(createSchema)` from `src/shared/zod.ts` — Zod 4 keeps `.default()` inside `.partial()`, which would reset unsent fields.
- Brand colours and logo come from Settings → Brand (`src/shared/branding.ts`); never hard-code colours in components.
- Validation messages are sentences a customer understands ("Enter a valid email.").
- UI copy: direct, short, says what happens next. One primary action per screen. Use the UI kit in `src/app/ui`; follow `DESIGN.md`.
- Query keys start with the module id (`["crm", …]`); invalidate `["metrics"]` after writes that change numbers.
- Public pages ship no client JavaScript.
- Slugs: `slugify` and `SLUG_PATTERN` from `src/shared/slug.ts`.

## Definition of done

1. The behaviour works end to end (API, UI, MCP tool where relevant) with loading, empty and error states.
2. `npm run check` passes and `npm run build` succeeds; new behaviour has tests in `tests/`.
3. Checked in the browser at desktop and phone widths when the UI changed.
4. Module README and the relevant `docs/` page describe the change.
5. Report what was verified and where: local, committed, pushed, deployed, verified in the deployed environment — never infer a later state from an earlier one.

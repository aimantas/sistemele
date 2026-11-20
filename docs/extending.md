# Extending Sistemėlė

**Don't ask your agent to reinvent the wheel.** Sign-in, roles, audit, CRM,
quotes, invoices, stock, a website and MCP already work and are tested. Build
only what is specific to the business, and build it the way the existing
modules are built, so the next agent can follow it too.

This guide is for coding agents and the people directing them. `AGENTS.md`
holds the rules; this page explains how to apply them.

## 1. Reuse before you build

Check what exists before writing code. Most requests are a configuration
change, a new field or a new screen on an existing module.

| You need | Use what is there |
| --- | --- |
| Sign-in, users, roles, API tokens | Core (`src/worker/auth`, `ctx.requireRole`, Settings → Team, Settings → API & agents) |
| Who owns a record | `assertTeamMember` + `GET /api/team` (`src/worker/lib/team.ts`), `OwnerSelect` in the CRM client |
| History of changes | `ctx.audit({...})` on every write; Settings → Audit log |
| People and companies | CRM contacts (`requires: ["crm"]`, `ContactPicker`) |
| Incoming requests | CRM leads; `POST /api/public/crm/inquiries` |
| A sales process | CRM pipeline stages (Pipeline → Stages), not a new status column |
| Prices, VAT, totals | `src/shared/money.ts`, `src/shared/lines.ts` |
| Documents with numbers | `gapFreeNumberStatements` (`src/worker/lib/sequences.ts`) |
| Products, services, stock | Catalog module and its stock ledger |
| Text pages, blog posts | Content module (no code: Website → Pages/Posts or the `content_*` tools) |
| Email | `renderEmail` + `ctx.sendEmail` (`docs/email.md`) |
| Dashboard numbers | A metric in the module's `metrics`; it appears in Customize → Add card |
| Search | The module's `search()` hook (Ctrl/Cmd+K) |
| Public pages, SEO | `renderPage` with unique meta, sitemap entry (`docs/seo.md`) |
| Agent access | `defineTool` in the module's `server/tools.ts`, served at `/mcp` |
| UI pieces | `src/app/ui` (shadcn/ui: Button, Field, Dialog, Table, EmptyState …); see `docs/design-system.md` and `/app/design` |

If one of these is almost right, extend it (a column, a filter, an event
handler) instead of writing a parallel version.

## 2. One module, one folder

A new capability is a module: `npm run module:new bookings "Bookings"`, then
follow the CRM module, the reference implementation.

```text
migrations/0008_bookings.sql      tables (TEXT ids with prefix, ISO dates, cents, bps)
src/modules/bookings/
  shared/schema.ts                Zod input schemas and types, shared by API, tools and forms
  server/service.ts               business logic: validate → requireRole → write → audit → emit
  server/routes.ts                thin Hono routes calling services
  server/tools.ts                 MCP tools wrapping the same services
  server/index.ts                 the ServerModule: api, tools, metrics, events, search, site
  client/api.ts                   TanStack Query hooks (keys start with "bookings")
  client/*Page.tsx, widgets.tsx   screens and dashboard cards from the UI kit
  client/index.tsx                the ClientModule: nav, routes, widgets, quick actions
  README.md                       tables, API, tools, metrics, events, rules
seed/0N_bookings.sql              fictional demo data
tests/bookings.test.ts            against a real D1
```

Switch it on in `sistemele.config.ts`. Switching it off removes its routes,
screens, widgets and tools; its tables stay.

## 3. Rules that keep it correct

- **Services are the only place for logic.** Routes, MCP tools, event handlers and tests call the same service functions with `ctx`. No SQL in routes or tools.
- **Validate, check, audit.** Every write parses its input with Zod, calls `ctx.requireRole`, and calls `ctx.audit`. Validation messages are sentences a customer understands.
- **Modules talk through events.** Never import another module's `server/` code. Add the event to `src/modules/events.ts`, `ctx.emit` it after the write, handle it in the other module's `events`. Handlers must be idempotent.
- **Money is integer cents; VAT and discounts are basis points.** The server computes totals; client totals are previews.
- **Migrations are append-only.** Never edit an applied migration; add the next numbered file. SQLite cannot drop a CHECK constraint in place: add a new column, copy, drop the old one (see `0007_crm_leads_stages.sql`). Never drop and recreate a table that other tables reference with `ON DELETE CASCADE`.
- **Partial updates stay partial.** Use `patchSchema(createSchema)` for PATCH bodies.
- **Facts stay true.** No invented reviews, prices, stock, reply times or certifications in copy, seeds, emails or structured data.
- **Local stays local.** `npm run dev` and the tests use a local D1. Anything with `--remote`, `wrangler deploy` or `wrangler secret put` needs a person's approval first.

## 4. Make it work for people and agents

- Every list has loading, empty and error states. Empty states say what to do next.
- One primary action per screen, top right. Forms name the button after the result ("Create lead", not "Submit").
- Check the screen at phone and desktop width; tables hide secondary columns below `md`.
- Every capability a person has in the dashboard should have an MCP tool. Tool descriptions say what the tool does, when to use it, units (cents, bps, YYYY-MM-DD) and what it returns.
- Offer a dashboard widget and a KPI metric when the module has numbers people watch.

## 5. Done means

1. It works end to end: API, screen and MCP tool, with loading, empty and error states.
2. `npm run check` (typecheck, lint, tests) and `npm run build` pass; new behaviour has tests.
3. The screen is checked in a browser at desktop and phone width.
4. The module README and the relevant `docs/` page describe the change.
5. The report says exactly what was verified and where: local, committed, pushed, deployed, verified on the deployed URL.

## Prompts that work

- "Read AGENTS.md. Add a bookings module: services with a duration and price, time slots, a public booking page that creates a lead, MCP tools and a dashboard widget for today's bookings."
- "Add a `budget` field to CRM leads: migration, schema, form, list column, MCP tool description, test."
- "Add a pipeline stage 'Site visit' at 40% after Qualified." (No code: Pipeline → Stages, or `crm_create_stage`.)
- "When a deal is won, create a task to schedule delivery." (An event handler on `deal.stage_changed`.)

## Setup and deployment

- Local setup: [getting-started.md](getting-started.md).
- Deployment to Cloudflare: [deployment.md](deployment.md).
- Module contract: [modules.md](modules.md). Agents and MCP: [ai-agents.md](ai-agents.md).

# Architecture

## One Worker, four surfaces

```text
                         ┌──────────────────────── Cloudflare Worker (src/worker/app.ts) ────────────────────────┐
request ─► securityHeaders ─► contextMiddleware ─► csrfGuard ─► requireSignedIn (API only) ─► route
                                    │
                                    └─ resolves user (API token → session cookie), builds ModuleContext

routes:   /api/auth/*          sign-in link, verify, logout, session          (public)
          /api/public/<mod>/*  module publicApi (forms, quote accept)         (public, rate-limited)
          /api/*               core API + module api                          (signed in)
          /mcp                 MCP JSON-RPC                                    (Bearer token)
          /sitemap.xml /robots.txt /llms.txt /health
          /, /contact, /privacy + module site routes (/products, /q/:t, /i/:t) (SSR, no JS)
          /app, /app/*         SPA shell from static assets                    (noindex)
          anything else        static asset or SSR 404
```

Static build files under `/assets/*` skip the Worker entirely
(`run_worker_first` in `wrangler.jsonc`).

## ModuleContext

Every request gets one `ModuleContext` (`src/worker/context.ts`). Services take
it as their first argument, which is why the same function serves the REST
route, the MCP tool, event handlers and tests:

| Member | Purpose |
| --- | --- |
| `db` | `Db` wrapper over D1: `all`, `first`, `value`, `run`, `batch`, `prepare`. |
| `user` | `SessionUser` or `null` on public routes. |
| `requireRole(min)` | Throws 401/403; returns the user. |
| `audit(entry)` | Appends to `audit_log`. |
| `emit(event, payload)` | Calls every enabled module's handler for the event, in module order. Errors are logged and audited, never thrown back. |
| `business()` | Seller profile from Settings (cached per request). |
| `sendEmail(email)` | Resend, or console in development; always logged. |
| `waitUntil(promise)` | Work after the response (emails). |

## Modules

A module is a folder with a server half and a client half that implement
`ServerModule` and `ClientModule` (`src/modules/types.server.ts`,
`types.client.ts`). Registries (`src/modules/server.ts`, `client.ts`) map ids to
implementations; `sistemele.config.ts` picks which are enabled and in what order.
`requires` is checked at startup. See [modules.md](modules.md).

## Events instead of imports

```text
quotes ──quote.sent──────► crm: deal → proposal, timeline entry
quotes ──quote.accepted──► crm: deal → won, timeline entry
invoices ─invoice.issued─► catalog: stock "sale" movements · crm: timeline
invoices ─invoice.voided─► catalog: stock "return" movements
invoices ─invoice.paid───► crm: timeline
catalog ──stock.low──────► (yours: notify purchasing, create a task …)
```

Events are typed in `src/modules/events.ts`. Handlers run in the same request,
after the emitting write has committed, and must be idempotent (catalog uses a
unique index on `(product, reference)`).

## Data

- D1 (SQLite). One migration per module in `migrations/`, applied in filename order by Wrangler.
- Conventions: prefixed TEXT ids, ISO-8601 UTC timestamps, money in cents, VAT in basis points, JSON in TEXT columns only for snapshots and tags.
- Multi-statement writes use `db.batch([...])`, which D1 runs as a transaction.
- Derived values (stock on hand, paid amount) are recomputed from their ledger in the same batch rather than incremented.

## Dashboard SPA

React 19 + React Router (lazy routes per module) + TanStack Query. The shell
builds navigation from enabled modules; the dashboard grid (dnd-kit) renders
widgets from the widget registry and saves layouts to `dashboard_layouts`.
See [dashboard.md](dashboard.md).

## Public site

React components rendered to static HTML on the Worker (`renderToStaticMarkup`),
with inline CSS and no client JavaScript. Every page can also return Markdown
when the client sends `Accept: text/markdown`. See [seo.md](seo.md).

## Security model

Sessions are random 256-bit tokens stored hashed; cookies are HttpOnly,
SameSite=Lax and `__Host-` prefixed on HTTPS. Cookie-authenticated writes must
come from the app origin. API tokens are hashed, scoped to a role no higher
than their owner's, and revocable. See [security.md](security.md).

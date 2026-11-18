# Modules

## Anatomy

```text
src/modules/<id>/
  README.md              what it does, tables, API, tools, metrics, widgets, events
  shared/schema.ts       Zod input schemas + response types (browser and Worker)
  server/service.ts      business logic; every function takes ctx: ModuleContext
  server/routes.ts       thin Hono routes → services (api, publicApi, site)
  server/tools.ts        MCP tools → services
  server/index.ts        export const <id>Module: ServerModule
  client/api.ts          TanStack Query hooks
  client/*Page.tsx       screens (default export, lazy-loaded)
  client/widgets.tsx     dashboard cards
  client/index.tsx       export const <id>Client: ClientModule
migrations/NNNN_<id>.sql
seed/NN_<id>.sql
tests/<id>.test.ts
```

## Create one

```bash
npm run module:new bookings "Bookings"
```

The script creates the folders above with working placeholders, a migration
file, a seed file and a test, registers the module in `src/modules/server.ts`
and `client.ts`, and enables it in `sistemele.config.ts`. Then:

1. Write the tables in the new migration; `npm run db:migrate`.
2. Define Zod schemas and types in `shared/schema.ts`.
3. Implement services. Pattern for a write:

   ```ts
   export async function createBooking(ctx: ModuleContext, raw: BookingInput) {
     const user = ctx.requireRole("member");
     const input = bookingInputSchema.parse(raw);
     const id = newId("bk");
     await ctx.db.run("INSERT INTO bookings (id, …) VALUES (?, …)", [id, …]);
     await ctx.audit({ action: "booking.created", entityType: "booking", entityId: id, summary: `Booked ${input.service}` });
     await ctx.emit("booking.created", { bookingId: id }); // after adding it to events.ts
     return getBooking(ctx, id);
   }
   ```

4. Expose it: route in `routes.ts`, tool in `tools.ts`, metric/search in `index.ts`.
5. Build screens with the UI kit (`@/app/ui`) and hooks in `client/api.ts`.
6. Add a widget if the module has a number or a list worth seeing daily.
7. Tests: copy `tests/crm.test.ts`; the harness gives you a real D1 with every migration.
8. Document it in the module README.

## The contract

`ServerModule` (all optional except id, name, description):

| Field | Mounted at / used by |
| --- | --- |
| `requires` | Startup check; also allows importing that module's `shared/` and `client/`. |
| `api` | `/api/<id>/*`, signed-in users and API tokens. |
| `publicApi` | `/api/public/<id>/*`, anonymous. Validate, rate-limit, never leak other records. |
| `site` | Public SSR routes at `/`. |
| `siteLinks` | Fixed header links on the public site. |
| `siteMenu` | Header links read from data on each page view (e.g. pages placed in the menu). One fast query. |
| `tools` | MCP `tools/list` and `tools/call`; also listed in `llms.txt`. |
| `metrics` | `/api/metrics`, KPI cards, `core_metrics` tool. |
| `events` | Reactions to other modules' events. |
| `search` | Command palette and `core_search` tool. |
| `sitemap` | `/sitemap.xml` entries. |
| `home` | Public home page: an optional hero (headline, lead, description) and sections below it, e.g. the content module's latest posts. |

`ClientModule`: `nav`, `routes` (relative to `/app`, use `lazy`), `widgets`,
`quickActions`.

## Switching modules off

Remove the id from `modules` in `sistemele.config.ts`. Routes, navigation,
widgets, metrics, tools and public pages disappear. Tables stay (migrations are
append-only), so switching back on loses nothing. A module that others
`require` cannot be switched off alone; the Worker refuses to start and says why.

## Rules

- No server imports across modules. Use events.
- Read another module's tables only for snapshots (e.g. invoices copy the contact's details when issuing). Never write them.
- Every public endpoint is rate-limited and returns the same answer whether or not a record exists, where that matters.
- Event handlers are idempotent; they may run again after a retry.

# Building a module

Reference implementation: `src/modules/crm/`. Copy its shape.

## Steps

1. `npm run module:new <id> "<Name>"` — scaffolds `src/modules/<id>/{shared,server,client}`, a migration, seed, test and README; registers the module in `src/modules/server.ts`, `src/modules/client.ts` and `sistemele.config.ts`.
2. **Migration** `migrations/NNNN_<id>.sql`: TEXT ids (`newId("<prefix>")`), `created_at`/`updated_at` ISO text with `strftime('%Y-%m-%dT%H:%M:%fZ','now')` defaults, cents and bps integers, CHECK constraints for enums, indexes for list filters. `npm run db:migrate`.
3. **`shared/schema.ts`**: Zod input schemas (`.trim()`, `.max()`, human messages), response interfaces in camelCase.
4. **`server/service.ts`**: one exported function per use case, first arg `ctx: ModuleContext`:
   - reads: `ctx.requireRole("member")`, SQL with column aliases to camelCase, `likePattern()` + `ESCAPE '\\'` for search, `{ items, total }` for lists;
   - writes: parse input → role check → `ctx.db.batch([...])` for multi-row writes → `ctx.audit(...)` → `ctx.emit(...)` → return the fresh record;
   - errors: `notFound("Booking")`, `conflict("…")`, `badRequest("…")`, `forbidden()` from `@/worker/lib/errors`.
5. **`server/routes.ts`**: `new Hono<AppEnv>()` routes calling services with `getContext(c)`; anonymous endpoints in a separate `publicApi` with `enforceRateLimit`.
6. **`server/tools.ts`**: `defineTool({ name: "<id>_<verb>_<noun>", title, description, input, readOnly, minRole, run })`.
7. **`server/index.ts`**: `ServerModule` with `api`, `publicApi?`, `site?`, `siteLinks?`, `tools`, `metrics`, `events`, `search`, `sitemap?`, `requires?`.
8. **Client**: `client/api.ts` (TanStack Query hooks; keys start with the module id; invalidate `["metrics"]` after writes), pages as default exports, `client/index.tsx` with `nav`, lazy `routes` (paths relative to `/app`), `widgets`, `quickActions`. UI from `@/app/ui`; forms show `fieldError(error, "field")`.
9. **Events**: add new event names and payloads to `src/modules/events.ts`; handle others' events in `events`.
10. **Seed** `seed/NN_<id>.sql` with fictional data (`INSERT OR IGNORE`). **Tests** `tests/<id>.test.ts` with `createTestApp()`.
11. **README** `src/modules/<id>/README.md`: purpose, tables, API, tools, metrics, widgets, events emitted/handled, extension notes.

## Checklist

- [ ] Validation 422 with field paths; roles 401/403; state conflicts 409.
- [ ] Lists have search, empty and error states; detail pages have a back link.
- [ ] MCP `tools/list` shows the new tools; `npm run doctor` clean.
- [ ] `npm run check && npm run build`.

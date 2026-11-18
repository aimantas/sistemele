---
description: Scaffold and fully implement a new Sistemėlė module
argument-hint: <id> <Name> — <what it should do>
---

Build a new module: $ARGUMENTS

1. Read AGENTS.md, docs/modules.md and the CRM reference module (`src/modules/crm/`).
2. Run `npm run module:new <id> "<Name>"` and read what it generated.
3. Design the tables, then write the migration and run `npm run db:migrate`.
4. Implement shared schemas, services, routes, MCP tools, metrics, search, events (add new event types to `src/modules/events.ts`), and client pages + at least one dashboard widget. Use `@/app/ui` components.
5. Seed fictional demo data in `seed/` and write `tests/<id>.test.ts` (validation, roles, state rules, MCP tools/list).
6. Write `src/modules/<id>/README.md`.
7. Run `npm run check` and `npm run build`; fix everything.
8. Start the dev server (`.claude/launch.json`) and check the new screens at desktop and 375px width.
9. Report what was built and verified. Do not commit unless asked.

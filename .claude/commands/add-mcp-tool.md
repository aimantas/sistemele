---
description: Add an MCP tool backed by a module service
argument-hint: <module> <what the tool does>
---

Add an MCP tool: $ARGUMENTS

1. Read `src/modules/<module>/server/service.ts` and `tools.ts`. Reuse an existing service function or add one (Zod validation, `ctx.requireRole`, `ctx.audit` on writes).
2. Add `defineTool({ name: "<module>_<verb>_<noun>", title, description, input, readOnly?, minRole?, run })`. The description tells an agent what it does, when to use it, units (cents, bps, YYYY-MM-DD) and the return shape.
3. Test in `tests/<module>.test.ts`: `tools/list` includes it, `tools/call` works, invalid input returns `isError`.
4. `npm run check`. Update the module README tool list.

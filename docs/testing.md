# Testing

```bash
npm test            # all tests once
npm run test:watch  # watch mode
```

Tests run in Node with Vitest. `tests/helpers.ts` starts Miniflare with an
in-memory D1, applies every file in `migrations/`, and calls the real Hono app
(`createApp(serverModules)`) with real bindings. No mocks of our own code.

```ts
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;
beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();          // real magic-link flow, returns the cookie
});
afterAll(() => t.dispose());

it("creates a contact", async () => {
  const response = await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Acme" } });
  expect(response.status).toBe(201);
});
```

Helpers: `t.request(path, { method, json, cookie, token, headers })`,
`t.signIn(email?)`, `t.createToken(cookie, role)`, `t.settle()` (await
`waitUntil` work such as emails), `addUser(t, email, role)`, direct SQL via `t.db`.

To call services or emit events directly:

```ts
import { createModuleContext } from "@/worker/context";
import { serverModules } from "@/modules/server";
const ctx = createModuleContext({ env: t.env, user: { id, email, name, role: "owner", via: "session" }, modules: serverModules });
await ctx.emit("invoice.issued", { … });
```

What to test for a module: validation messages (422 with field paths), role
checks (401/403), state rules (409), money totals computed on the server,
events and their side effects, public endpoints (rate limits, unknown tokens),
MCP `tools/list` includes the module's tools.

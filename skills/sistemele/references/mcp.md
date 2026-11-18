# MCP

## Using a running installation

Endpoint: `POST <APP_URL>/mcp` (Streamable HTTP, stateless, JSON). Header
`Authorization: Bearer sk_…` — the user creates the token in Settings → API &
agents and picks its role (member/admin/owner, never above their own).

```bash
claude mcp add --transport http sistemele https://<domain>/mcp --header "Authorization: Bearer sk_…"
```

Start with `core_whoami` (user, role, enabled modules), then `core_search` to
find ids, then module tools. Money is in cents, VAT in basis points, dates
`YYYY-MM-DD`. Read before you write; confirm with the human before
irreversible actions (`invoices_issue`, voids, sending emails to customers).

## Adding a tool

`src/modules/<module>/server/tools.ts`:

```ts
defineTool({
  name: "<module>_<verb>_<noun>",
  title: "Human title",
  description: "What it does, when to use it, units, what it returns.",
  input: z.object({ … }),      // reuse shared/schema.ts schemas where possible
  readOnly: true,               // for reads
  minRole: "admin",             // for admin-only actions
  run: (input, ctx) => service(ctx, input),
})
```

Add it to the module's `tools`. Test: `tools/list` contains it; `tools/call`
returns `structuredContent`; invalid input returns `isError: true`.

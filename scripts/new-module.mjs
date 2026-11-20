#!/usr/bin/env node
// Scaffolds a working module (list + create + delete of "items") and registers it.
// Usage: npm run module:new <id> "<Name>"   e.g. npm run module:new bookings "Bookings"
// Then rename the placeholder table/fields to the real domain (see docs/modules.md).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const [id, rawName] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9]{1,30}$/u.test(id)) {
  console.error('Usage: npm run module:new <id> "<Name>"  — id: lowercase letters/digits, e.g. bookings');
  process.exit(1);
}
const name = rawName?.trim() || id[0].toUpperCase() + id.slice(1);
const base = `src/modules/${id}`;
if (existsSync(base)) {
  console.error(`${base} already exists.`);
  process.exit(1);
}

const table = `${id}_items`;
const prefix = id.slice(0, 3);
const migrationNumber = String(readdirSync("migrations").filter((f) => /^\d{4}_/u.test(f)).length + 1).padStart(4, "0");
const seedNumber = String(readdirSync("seed").filter((f) => f.endsWith(".sql")).length + 1).padStart(2, "0");

const files = {
  [`migrations/${migrationNumber}_${id}.sql`]: `-- ${name}: replace the placeholder table with the real model.

CREATE TABLE ${table} (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ${table}_created_idx ON ${table}(created_at);
`,

  [`seed/${seedNumber}_${id}.sql`]: `-- Fictional demo data for ${name} (local development only).
INSERT OR IGNORE INTO ${table} (id, name, notes) VALUES
 ('${prefix}_demo_1', 'First ${name.toLowerCase()} item', 'Replace with realistic demo data.');
`,

  [`${base}/shared/schema.ts`]: `import { z } from "zod";

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200),
  notes: z.string().trim().max(5000).default(""),
});
export type ItemInput = z.input<typeof itemInputSchema>;

export interface Item {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
`,

  [`${base}/server/service.ts`]: `import type { Page } from "@/shared/api";
import { newId } from "@/shared/ids";
import type { ModuleContext } from "@/modules/types.server";
import { likePattern, type SqlValue } from "@/worker/lib/db";
import { notFound } from "@/worker/lib/errors";
import { itemInputSchema, type Item, type ItemInput } from "../shared/schema";

const COLUMNS = "id, name, notes, created_at AS createdAt, updated_at AS updatedAt";

export async function listItems(ctx: ModuleContext, options: { q?: string; limit?: number; offset?: number } = {}): Promise<Page<Item>> {
  ctx.requireRole("member");
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (options.q?.trim()) {
    where.push("name LIKE ? ESCAPE '\\\\'");
    params.push(likePattern(options.q.trim()));
  }
  const whereSql = where.length ? \`WHERE \${where.join(" AND ")}\` : "";
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const [items, total] = await Promise.all([
    ctx.db.all<Item>(\`SELECT \${COLUMNS} FROM ${table} \${whereSql} ORDER BY created_at DESC LIMIT \${limit} OFFSET \${offset}\`, params),
    ctx.db.value<number>(\`SELECT COUNT(*) FROM ${table} \${whereSql}\`, params),
  ]);
  return { items, total: total ?? 0 };
}

export async function getItem(ctx: ModuleContext, id: string): Promise<Item> {
  ctx.requireRole("member");
  const item = await ctx.db.first<Item>(\`SELECT \${COLUMNS} FROM ${table} WHERE id = ?\`, [id]);
  if (!item) throw notFound("${name} item");
  return item;
}

export async function createItem(ctx: ModuleContext, raw: ItemInput): Promise<Item> {
  const user = ctx.requireRole("member");
  const input = itemInputSchema.parse(raw);
  const id = newId("${prefix}");
  await ctx.db.run("INSERT INTO ${table} (id, name, notes, created_by) VALUES (?, ?, ?, ?)", [id, input.name, input.notes, user.id]);
  await ctx.audit({ action: "${id}.created", entityType: "${id}", entityId: id, summary: \`Created \${input.name}\` });
  return getItem(ctx, id);
}

export async function deleteItem(ctx: ModuleContext, id: string): Promise<void> {
  const item = await getItem(ctx, id);
  await ctx.db.run("DELETE FROM ${table} WHERE id = ?", [id]);
  await ctx.audit({ action: "${id}.deleted", entityType: "${id}", entityId: id, summary: \`Deleted \${item.name}\` });
}
`,

  [`${base}/server/routes.ts`]: `import { Hono } from "hono";
import { z } from "zod";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { readQuery } from "@/worker/lib/validate";
import * as service from "./service";

/** Mounted at /api/${id} (signed-in users). */
export const ${id}Api = new Hono<AppEnv>()
  .get("/items", async (c) => {
    const query = readQuery(c, z.object({ q: z.string().max(100).optional(), limit: z.coerce.number().optional(), offset: z.coerce.number().optional() }));
    return c.json(await service.listItems(getContext(c), query));
  })
  .post("/items", async (c) => c.json(await service.createItem(getContext(c), await c.req.json()), 201))
  .get("/items/:id", async (c) => c.json(await service.getItem(getContext(c), c.req.param("id"))))
  .delete("/items/:id", async (c) => {
    await service.deleteItem(getContext(c), c.req.param("id"));
    return c.json({ ok: true });
  });
`,

  [`${base}/server/tools.ts`]: `import { z } from "zod";
import { defineTool } from "@/modules/types.server";
import { itemInputSchema } from "../shared/schema";
import * as service from "./service";

export const ${id}Tools = [
  defineTool({
    name: "${id}_list_items",
    title: "List ${name.toLowerCase()} items",
    description: "Lists ${name.toLowerCase()} items, newest first. Optional \`query\` filters by name. Returns { items, total }.",
    input: z.object({ query: z.string().max(100).optional(), limit: z.number().int().min(1).max(100).default(25) }),
    readOnly: true,
    run: ({ query, limit }, ctx) => service.listItems(ctx, { q: query, limit }),
  }),
  defineTool({
    name: "${id}_create_item",
    title: "Create ${name.toLowerCase()} item",
    description: "Creates a ${name.toLowerCase()} item with a name and optional notes.",
    input: itemInputSchema,
    run: (input, ctx) => service.createItem(ctx, input),
  }),
];
`,

  [`${base}/server/index.ts`]: `import type { ServerModule } from "@/modules/types.server";
import { likePattern } from "@/worker/lib/db";
import { ${id}Api } from "./routes";
import { ${id}Tools } from "./tools";

/** ${name} module. See src/modules/${id}/README.md. */
export const ${id}Module: ServerModule = {
  id: "${id}",
  name: "${name}",
  description: "Describe what ${name} does in one sentence.",
  api: ${id}Api,
  tools: ${id}Tools,
  metrics: [
    {
      key: "${id}.items_total",
      label: "${name} items",
      description: "Number of ${name.toLowerCase()} items.",
      format: "number",
      async compute(ctx) {
        return { value: (await ctx.db.value<number>("SELECT COUNT(*) FROM ${table}")) ?? 0 };
      },
    },
  ],
  async search(term, ctx) {
    const rows = await ctx.db.all<{ id: string; name: string }>("SELECT id, name FROM ${table} WHERE name LIKE ? ESCAPE '\\\\' ORDER BY created_at DESC LIMIT 8", [likePattern(term)]);
    return rows.map((row) => ({ module: "${id}", type: "item", id: row.id, title: row.name, href: \`/app/${id}/\${row.id}\` }));
  },
};
`,

  [`${base}/client/api.ts`]: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import { api, queryString } from "@/app/lib/api";
import type { Item, ItemInput } from "../shared/schema";

export function useItems(params: { q?: string } = {}) {
  return useQuery({ queryKey: ["${id}", "items", params], queryFn: () => api.get<Page<Item>>(\`/api/${id}/items\${queryString(params)}\`) });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => api.post<Item>("/api/${id}/items", input),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ["${id}"] }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.delete(\`/api/${id}/items/\${itemId}\`),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ["${id}"] }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]),
  });
}
`,

  [`${base}/client/ItemsPage.tsx`]: `import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Button, EmptyState, ErrorState, Field, FormError, IconButton, Input, PageHeader, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { useCreateItem, useDeleteItem, useItems } from "./api";

export default function ItemsPage() {
  const format = useFormat();
  const items = useItems();
  const create = useCreateItem();
  const remove = useDeleteItem();
  const [name, setName] = useState("");

  return (
    <div className="max-w-4xl">
      <PageHeader title="${name}" description="Replace this screen with the real ${name.toLowerCase()} workflow." />
      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ name }, { onSuccess: () => setName("") });
        }}
      >
        <Field label="Name" className="min-w-64 flex-1" error={fieldError(create.error, "name")}>
          {(props) => <Input {...props} value={name} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Button type="submit" icon={<Plus />} loading={create.isPending}>
          Add item
        </Button>
      </form>
      <FormError error={create.error && !fieldError(create.error, "name") ? create.error : null} />
      {items.isLoading ? <Spinner /> : null}
      {items.error ? <ErrorState error={items.error} retry={() => items.refetch()} /> : null}
      {items.data?.items.length === 0 ? <EmptyState title="No items yet" description="Add the first one above." /> : null}
      {items.data?.items.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Created</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.data.items.map((item) => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.name}</Td>
                <Td>{format.date(item.createdAt)}</Td>
                <Td align="right">
                  <IconButton label={\`Delete \${item.name}\`} onClick={() => remove.mutate(item.id)}>
                    <Trash2 />
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  );
}
`,

  [`${base}/client/widgets.tsx`]: `import { Link } from "react-router";
import { Spinner } from "@/app/ui";
import { useItems } from "./api";

export function RecentItemsWidget() {
  const items = useItems();
  if (!items.data) return <Spinner />;
  if (items.data.items.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ul className="grid gap-1">
      {items.data.items.slice(0, 6).map((item) => (
        <li key={item.id}>
          <Link to="/app/${id}" className="block truncate rounded-md px-1 py-1.5 text-sm hover:bg-accent">
            {item.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
`,

  [`${base}/client/dev.ts`]: `import type { DevPage } from "@/modules/types.client";

/** Developer panel notes and agent prompts for the ${name} pages (dev mode). */
export const ${id}Dev: DevPage[] = [
  {
    path: "${id}",
    title: "${name}",
    summary: "Replace with one sentence on what this page is for.",
    files: [
      { path: "${base}/client/ItemsPage.tsx", note: "List and new item form" },
      { path: "${base}/server/service.ts", note: "Services: validation, roles, audit" },
      { path: "${base}/shared/schema.ts", note: "Zod schemas" },
      { path: "migrations/${migrationNumber}_${id}.sql", note: "Tables" },
      { path: "tests/${id}.test.ts", note: "Tests" },
    ],
    prompts: [
      "Replace the placeholder ${name.toLowerCase()} table with the real model: migration, schemas, service, routes, MCP tools, the page and tests.",
      "Add a detail page for one ${name.toLowerCase()} item with an edit form and its developer panel notes.",
    ],
  },
];
`,

  [`${base}/client/index.tsx`]: `import { Boxes } from "lucide-react";
import { lazy } from "react";
import type { ClientModule } from "@/modules/types.client";
import { ${id}Dev } from "./dev";

export const ${id}Client: ClientModule = {
  id: "${id}",
  name: "${name}",
  nav: [{ to: "/app/${id}", label: "${name}", icon: Boxes }],
  routes: [{ path: "${id}", lazy: () => import("./ItemsPage").then((m) => ({ Component: m.default })) }],
  widgets: [
    {
      type: "${id}.recent-items",
      title: "Recent ${name.toLowerCase()}",
      description: "The latest ${name.toLowerCase()} items.",
      defaultSize: { w: 2, h: 1 },
      component: lazy(() => import("./widgets").then((m) => ({ default: m.RecentItemsWidget }))),
    },
  ],
  quickActions: [],
  dev: ${id}Dev,
};
`,

  [`${base}/README.md`]: `# ${name}

Describe the job this module does for the business in two sentences.

| | |
| --- | --- |
| Tables | \`${table}\` (migrations/${migrationNumber}_${id}.sql) — placeholder, rename to the real model |
| API | \`GET/POST /api/${id}/items\`, \`GET/DELETE /api/${id}/items/:id\` |
| MCP tools | \`${id}_list_items\`, \`${id}_create_item\` |
| Metrics | \`${id}.items_total\` |
| Widgets | \`${id}.recent-items\` |
| Events | emits: none yet · handles: none yet |

## Next steps

1. Model the real tables in the migration (it has not been applied anywhere but your machine).
2. Replace the "item" schema, services, routes, tools and screens.
3. Add events to \`src/modules/events.ts\` if other modules should react.
4. Update this README and \`tests/${id}.test.ts\`.
`,

  [`tests/${id}.test.ts`]: `import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
});
afterAll(() => t.dispose());

it("creates, lists and deletes ${name.toLowerCase()} items", async () => {
  const created = await json<{ id: string }>(await t.request("/api/${id}/items", { method: "POST", cookie: owner, json: { name: "Example" } }));
  const list = await json<{ total: number }>(await t.request("/api/${id}/items", { cookie: owner }));
  expect(list.total).toBe(1);
  await t.request(\`/api/${id}/items/\${created.id}\`, { method: "DELETE", cookie: owner });
  expect((await json<{ total: number }>(await t.request("/api/${id}/items", { cookie: owner }))).total).toBe(0);
});

it("validates input", async () => {
  expect((await t.request("/api/${id}/items", { method: "POST", cookie: owner, json: { name: "" } })).status).toBe(422);
});

it("requires sign-in", async () => {
  expect((await t.request("/api/${id}/items")).status).toBe(401);
});
`,
};

for (const [path, content] of Object.entries(files)) {
  mkdirSync(path.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(path, content);
  console.log(`created ${path}`);
}

function register(path, importLine, entry) {
  let source = readFileSync(path, "utf8");
  const imports = [...source.matchAll(/^import .*;$/gmu)];
  const last = imports[imports.length - 1];
  source = source.slice(0, last.index + last[0].length) + `\n${importLine}` + source.slice(last.index + last[0].length);
  source = source.replace(/(const available: Record<string, \w+> = \{\n)([\s\S]*?)(\n\};)/u, (_m, open, body, close) => `${open}${body}\n  ${entry}${close}`);
  writeFileSync(path, source);
  console.log(`registered in ${path}`);
}
register("src/modules/server.ts", `import { ${id}Module } from "./${id}/server";`, `${id}: ${id}Module,`);
register("src/modules/client.ts", `import { ${id}Client } from "./${id}/client";`, `${id}: ${id}Client,`);

let config = readFileSync("sistemele.config.ts", "utf8");
config = config.replace(/modules:\s*\[([^\]]*)\]/u, (_m, list) => `modules: [${list.trim().replace(/,\s*$/u, "")}, "${id}"]`);
writeFileSync("sistemele.config.ts", config);
console.log("enabled in sistemele.config.ts");

console.log(`
Next:
  npm run db:migrate
  npm test -- tests/${id}.test.ts
  npm run dev   → http://localhost:5173/app/${id}
Then model the real domain: docs/modules.md`);

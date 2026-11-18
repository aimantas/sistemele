#!/usr/bin/env node
// Static checks for configuration and module wiring. Usage: npm run doctor
import { existsSync, readdirSync, readFileSync } from "node:fs";

const problems = [];
const warnings = [];
const ok = [];
const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");

// Runtime
const [major] = process.versions.node.split(".").map(Number);
(major >= 22 ? ok : problems).push(`Node ${process.versions.node}${major >= 22 ? "" : " — Node 22+ required"}`);

// Local env
if (existsSync(".dev.vars")) ok.push(".dev.vars present");
else warnings.push(".dev.vars missing — run `npm run setup`");

// wrangler.jsonc
const wrangler = read("wrangler.jsonc");
if (wrangler.includes("00000000-0000-0000-0000-000000000000")) warnings.push("D1 database_id is the placeholder (fine locally; run `npm run setup:cloudflare` before deploying)");
if (wrangler.includes("sistemele.example.com")) warnings.push("vars.APP_URL is the example origin");
if (/"ADMIN_EMAILS":\s*"owner@example\.com"/u.test(wrangler)) warnings.push("vars.ADMIN_EMAILS is the example address");

// Migrations
const migrations = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
const numbers = migrations.map((f) => Number(f.slice(0, 4)));
numbers.forEach((n, i) => {
  if (n !== i + 1) problems.push(`Migration numbering gap or duplicate at ${migrations[i]} (expected ${String(i + 1).padStart(4, "0")})`);
});
ok.push(`${migrations.length} migrations`);

// Modules
const config = read("sistemele.config.ts");
const enabled = [...(config.match(/modules:\s*\[([^\]]*)\]/u)?.[1] ?? "").matchAll(/"([a-z0-9]+)"/gu)].map((m) => m[1]);
const serverRegistry = read("src/modules/server.ts");
const clientRegistry = read("src/modules/client.ts");
for (const id of enabled) {
  const base = `src/modules/${id}`;
  if (!existsSync(`${base}/server/index.ts`)) problems.push(`${id}: missing ${base}/server/index.ts`);
  if (!existsSync(`${base}/client/index.tsx`)) problems.push(`${id}: missing ${base}/client/index.tsx`);
  if (!new RegExp(`\\b${id}:\\s*${id}Module\\b`, "u").test(serverRegistry)) problems.push(`${id}: not registered in src/modules/server.ts`);
  if (!new RegExp(`\\b${id}:\\s*${id}Client\\b`, "u").test(clientRegistry)) problems.push(`${id}: not registered in src/modules/client.ts`);
  if (!existsSync(`${base}/README.md`)) warnings.push(`${id}: no README.md (agents rely on it)`);
  if (!existsSync(`tests/${id}.test.ts`)) warnings.push(`${id}: no tests/${id}.test.ts`);
  const requires = read(`${base}/server/index.ts`).match(/requires:\s*\[([^\]]*)\]/u)?.[1];
  for (const dep of [...(requires ?? "").matchAll(/"([a-z0-9]+)"/gu)].map((m) => m[1])) {
    if (!enabled.includes(dep)) problems.push(`${id} requires "${dep}", which is not enabled`);
  }
}
ok.push(`Modules enabled: ${enabled.join(", ") || "none"}`);

// Dashboard templates reference real widget types and metric keys
const sources = enabled.map((id) => read(`src/modules/${id}/client/index.tsx`)).join("\n") + read("src/app/dashboard/core-widgets.tsx");
const widgetTypes = new Set([...sources.matchAll(/type:\s*"([a-z0-9-]+\.[a-z0-9-]+)"/gu)].map((m) => m[1]));
const serverSources = enabled.map((id) => read(`src/modules/${id}/server/index.ts`)).join("\n");
const metricKeys = new Set([...serverSources.matchAll(/key:\s*"([a-z0-9_]+\.[a-z0-9_]+)"/gu)].map((m) => m[1]));
const templates = read("src/app/dashboard/templates.ts");
for (const [, type] of templates.matchAll(/type:\s*"([a-z0-9-]+\.[a-z0-9-]+)"/gu)) {
  const module = type.split(".")[0];
  if (module !== "core" && !enabled.includes(module)) continue;
  if (!widgetTypes.has(type)) warnings.push(`Template widget "${type}" is not defined by any enabled module`);
}
for (const [, key] of templates.matchAll(/metric\("([a-z0-9_]+\.[a-z0-9_]+)"\)/gu)) {
  if (enabled.includes(key.split(".")[0]) && !metricKeys.has(key)) warnings.push(`Template metric "${key}" is not defined`);
}
ok.push(`${widgetTypes.size} widget types, ${metricKeys.size} metrics`);

for (const line of ok) console.log(`  ok    ${line}`);
for (const line of new Set(warnings)) console.log(`  warn  ${line}`);
for (const line of problems) console.log(`  FAIL  ${line}`);
console.log(problems.length ? `\n${problems.length} problem(s).` : "\nNo problems found.");
process.exit(problems.length ? 1 : 0);

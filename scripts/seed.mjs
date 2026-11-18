#!/usr/bin/env node
// Loads demo data: every seed/*.sql file in order.
//   npm run db:seed        → the LOCAL D1 database (default)
//   npm run db:seed:demo   → the remote database of the `demo` environment only
// It never targets production: the only remote it accepts is --env demo.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const demo = process.argv.includes("--demo");
const target = demo ? ["--remote", "--env", "demo"] : ["--local"];
const files = readdirSync("seed").filter((file) => file.endsWith(".sql")).sort();
for (const file of files) {
  process.stdout.write(`Seeding ${file}${demo ? " (demo, remote)" : ""}… `);
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", ...target, `--file=seed/${file}`, "--yes"], { stdio: ["ignore", "ignore", "inherit"] });
  process.stdout.write("done\n");
}
console.log(demo ? "Demo data loaded into the demo database." : "Demo data loaded. Sign in with an address from ADMIN_EMAILS in .dev.vars.");

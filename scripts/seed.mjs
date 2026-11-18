#!/usr/bin/env node
// Loads demo data into the LOCAL D1 database: every seed/*.sql file in order.
// Never runs against production. Usage: npm run db:seed
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("seed").filter((file) => file.endsWith(".sql")).sort();
for (const file of files) {
  process.stdout.write(`Seeding ${file}… `);
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--local", `--file=seed/${file}`], { stdio: ["ignore", "ignore", "inherit"] });
  process.stdout.write("done\n");
}
console.log("Demo data loaded. Sign in with an address from ADMIN_EMAILS in .dev.vars.");

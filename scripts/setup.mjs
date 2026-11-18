#!/usr/bin/env node
// Local setup: .dev.vars, local D1 migrations, optional demo data.
// Usage: npm run setup [-- --admin you@example.com] [-- --no-seed]
// Never touches remote Cloudflare resources.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const adminIndex = args.indexOf("--admin");
const admin = adminIndex >= 0 ? args[adminIndex + 1] : undefined;
const seed = !args.includes("--no-seed");

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`Node 22 or newer is required (found ${process.versions.node}).`);
  process.exit(1);
}

if (!existsSync(".dev.vars")) {
  copyFileSync(".dev.vars.example", ".dev.vars");
  console.log("Created .dev.vars from .dev.vars.example");
} else {
  console.log(".dev.vars already exists — kept as is");
}
if (admin) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(admin)) {
    console.error(`"${admin}" is not an email address.`);
    process.exit(1);
  }
  const vars = readFileSync(".dev.vars", "utf8").replace(/^ADMIN_EMAILS=.*$/mu, `ADMIN_EMAILS=${admin}`);
  writeFileSync(".dev.vars", vars);
  console.log(`ADMIN_EMAILS set to ${admin}`);
}

const run = (script) => execFileSync("npm", ["run", "--silent", script], { stdio: "inherit" });
console.log("\nApplying migrations to the local D1 database…");
run("db:migrate");
if (seed) {
  console.log("\nLoading demo data…");
  run("db:seed");
}

const signInEmail = admin ?? (readFileSync(".dev.vars", "utf8").match(/^ADMIN_EMAILS=([^,\n]+)/mu)?.[1] ?? "owner@example.com");
console.log(`
Ready.

  npm run dev
  Public site  http://localhost:5173/
  Dashboard    http://localhost:5173/app  (sign in as ${signInEmail})

The sign-in link appears on screen and in the terminal until RESEND_API_KEY is set.
Next: edit sistemele.config.ts and read AGENTS.md.`);

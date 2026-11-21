#!/usr/bin/env node
// Local setup: .dev.vars, local D1 migrations, optional demo data.
// Usage: npm run setup [-- --admin you@example.com] [-- --no-seed]
// Never touches remote Cloudflare resources.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const adminIndex = args.indexOf("--admin");
const admin = adminIndex >= 0 ? args[adminIndex + 1] : undefined;
const seed = !args.includes("--no-seed");

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`Node 22 or newer is required (found ${process.versions.node}).`);
  process.exit(1);
}

// Local values that override wrangler.jsonc vars, then the secrets from .dev.vars.example.
const LOCAL_VARS = `# Local development values (git-ignored). Created by npm run setup.
APP_ENV=development
APP_URL=http://localhost:5173
EMAIL_FROM=Sistemele <onboarding@resend.dev>
# Optional Cloudflare Turnstile secret for the public contact form.
TURNSTILE_SECRET_KEY=
# "1" turns this into a public demo: one-click sign-in, no email, data reset by the Cron Trigger.
DEMO_MODE=

`;
if (!existsSync(".dev.vars")) {
  // Secrets live here: readable by you only.
  writeFileSync(".dev.vars", LOCAL_VARS + readFileSync(".dev.vars.example", "utf8"), { mode: 0o600 });
  console.log("Created .dev.vars (local values + secrets from .dev.vars.example)");
} else {
  console.log(".dev.vars already exists — kept as is");
}
if (admin) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(admin)) {
    console.error(`"${admin}" is not an email address.`);
    process.exit(1);
  }
  const vars = readFileSync(".dev.vars", "utf8").replace(/^ADMIN_EMAILS=.*$/mu, `ADMIN_EMAILS=${admin}`);
  writeFileSync(".dev.vars", vars, { mode: 0o600 });
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

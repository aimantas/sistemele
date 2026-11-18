#!/usr/bin/env node
// Creates the production D1 database, writes its id into wrangler.jsonc and
// applies migrations remotely. Asks before every remote change.
// Usage: npm run setup:cloudflare
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const confirm = async (question) => /^y(es)?$/iu.test((await rl.question(`${question} [y/N] `)).trim());
const wrangler = (args, options = {}) => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", ...options });

try {
  try {
    console.log(wrangler(["whoami"]).split("\n").filter((line) => /account|logged in|email/iu.test(line)).join("\n"));
  } catch {
    console.error("Not logged in. Run `npx wrangler login` first.");
    process.exit(1);
  }

  let config = readFileSync("wrangler.jsonc", "utf8");
  const name = config.match(/"database_name":\s*"([^"]+)"/u)?.[1] ?? "sistemele";

  if (config.includes(PLACEHOLDER)) {
    if (!(await confirm(`Create a D1 database named "${name}" in this Cloudflare account?`))) process.exit(0);
    const output = wrangler(["d1", "create", name]);
    const id = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u)?.[0];
    if (!id) {
      console.error(`Could not read the database id from Wrangler's output:\n${output}`);
      process.exit(1);
    }
    config = config.replace(PLACEHOLDER, id);
    writeFileSync("wrangler.jsonc", config);
    console.log(`Created D1 "${name}" (${id}) and saved the id in wrangler.jsonc.`);
  } else {
    console.log(`wrangler.jsonc already has a database id for "${name}".`);
  }

  if (await confirm(`Apply migrations to the REMOTE database "${name}"?`)) {
    execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--remote"], { stdio: "inherit" });
  }

  const warnings = [];
  if (/"APP_URL":\s*"https:\/\/sistemele\.example\.com"/u.test(config)) warnings.push("Set vars.APP_URL to your real https origin.");
  if (/"ADMIN_EMAILS":\s*"owner@example\.com"/u.test(config)) warnings.push("Set vars.ADMIN_EMAILS to your email.");
  if (/hello@example\.com/u.test(config)) warnings.push("Set vars.EMAIL_FROM to an address on your verified Resend domain.");
  console.log(`
Next steps:
${warnings.map((w) => `  - ${w}`).join("\n")}
  - npx wrangler secret put RESEND_API_KEY
  - npm run deploy
  - Sign in at <APP_URL>/app/login and fill in Settings → Business.`);
} finally {
  rl.close();
}

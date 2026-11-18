#!/usr/bin/env node
// Replaces the site's placeholders in every file under public/ and records the
// new values in site.config.json, which always mirrors what the files contain.
//
//   node scripts/configure.mjs --origin https://example.com --owner your-github-user --email hello@example.com
//   node scripts/configure.mjs --owner your-github-user --dry-run
//
// Only the flags you pass change. Run it from the website/ folder or anywhere.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'site.config.json');
const publicDir = join(root, 'public');
const textFiles = new Set(['.html', '.txt', '.xml', '.css', '.js', '.json', '.svg', '']);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const dryRun = args.includes('--dry-run');

const current = JSON.parse(await readFile(configPath, 'utf8'));
const next = { ...current };

const origin = flag('origin');
if (origin !== undefined) {
  let url;
  try { url = new URL(origin); } catch { fail(`--origin must be a full URL such as https://example.com (got "${origin}")`); }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) fail('--origin must be https://host with no path, for example https://example.com');
  next.origin = url.origin;
}
const owner = flag('owner');
if (owner !== undefined) {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) fail(`--owner must be a GitHub user or organisation name (got "${owner}")`);
  next.githubOwner = owner;
}
const email = flag('email');
if (email !== undefined) {
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) fail(`--email must be an address such as hello@example.com (got "${email}")`);
  next.contactEmail = email;
}

// Email first (its domain can overlap the origin), then the owner, then the origin.
const pairs = [
  [current.contactEmail, next.contactEmail],
  [`${current.githubOwner}/sistemele`, `${next.githubOwner}/sistemele`],
  [current.origin, next.origin],
].filter(([from, to]) => from !== to);

if (!pairs.length) {
  console.log('Nothing to change. Pass --origin, --owner or --email.');
  process.exit(0);
}

let changedFiles = 0;
for (const file of await walk(publicDir)) {
  if (!textFiles.has(extname(file))) continue;
  const before = await readFile(file, 'utf8');
  let after = before;
  const counts = [];
  for (const [from, to] of pairs) {
    const n = after.split(from).length - 1;
    if (n) { after = after.split(from).join(to); counts.push(`${n} × ${from}`); }
  }
  if (after !== before) {
    changedFiles++;
    console.log(`${relative(root, file)}: ${counts.join(', ')}`);
    if (!dryRun) await writeFile(file, after);
  }
}
if (!dryRun) await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`${dryRun ? 'Would change' : 'Changed'} ${changedFiles} file(s).${dryRun ? '' : ' site.config.json updated.'}`);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

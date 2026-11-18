# Deployment

Sistemėlė deploys as one Cloudflare Worker with static assets and one D1
database. The Workers free plan is enough to start; check
[Cloudflare's pricing](https://developers.cloudflare.com/workers/platform/pricing/) for limits.

## First deploy

```bash
npx wrangler login
```

1. **Configure** `wrangler.jsonc`:
   - `name` — the Worker name (becomes `<name>.<account>.workers.dev`).
   - `vars.APP_URL` — the public origin, e.g. `https://office.example.com` (no trailing slash).
   - `vars.ADMIN_EMAILS` — who becomes an owner on first sign-in.
   - `vars.EMAIL_FROM` — sender on your verified Resend domain.
   - `vars.APP_ENV` — `production` (robots.txt allows indexing only here).
2. **Database**: `npm run setup:cloudflare` creates the D1 database, writes its id into `wrangler.jsonc` and applies migrations remotely. Manual equivalent:

   ```bash
   npx wrangler d1 create sistemele          # copy database_id into wrangler.jsonc
   npm run db:migrate:remote
   ```

3. **Secrets**:

   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY   # optional, protects the contact form
   ```

4. **Deploy**: `npm run deploy` (builds the client and Worker, then `wrangler deploy`).
5. **Sign in** at `APP_URL/app/login` with an `ADMIN_EMAILS` address. Fill in Settings → Business (legal name, VAT code, IBAN) before issuing invoices.

## Custom domain

Workers & Pages → your Worker → Settings → Domains & Routes → Add custom
domain. Then set `APP_URL` to it and deploy again (canonical URLs, sitemap,
email links and cookies use it).

## Updates

```bash
npm run db:migrate:remote   # when migrations/ changed — before deploying code that needs them
npm run deploy
```

Migrations are append-only. Never edit a migration that production has applied.

## Previews and environments

Add an environment to `wrangler.jsonc` with its **own D1 database** — never
point a preview at production data:

```jsonc
"env": {
  "preview": {
    "name": "sistemele-preview",
    "vars": { "APP_URL": "https://sistemele-preview.<account>.workers.dev", "APP_ENV": "preview", "ADMIN_EMAILS": "you@example.com", "EMAIL_FROM": "…", "APP_NAME": "Sistemėlė (preview)" },
    "d1_databases": [{ "binding": "DB", "database_name": "sistemele-preview", "database_id": "…", "migrations_dir": "migrations" }]
  }
}
```

Deploy with `npx wrangler deploy --env preview` (after `CLOUDFLARE_ENV=preview npx vite build`).
`robots.txt` disallows everything outside production.

## Public demo

A demo is an installation anyone can open without an account. Set `DEMO_MODE` to `"1"` and the Worker:

- shows **Open the demo** on `/app/login` instead of the email form; it signs the visitor in as one shared owner account (`demo@sistemele.invalid`), rate-limited per IP;
- refuses email sign-in and never sends email, even with `RESEND_API_KEY` set (every email is only logged);
- shows a banner in the dashboard and a bar on public pages that say it is sample data;
- sends `X-Robots-Tag: noindex, nofollow` (every non-production `APP_ENV` does) and a disallow-all `robots.txt`;
- on each Cron Trigger, empties every table (users and sessions included) and reloads `seed/*.sql` (`src/worker/demo.ts`).

The `demo` environment in `wrangler.jsonc` defines a separate Worker, D1 database, custom domain and hourly trigger. Before running these commands, set `database_id` to a dedicated demo database and configure `routes` and `APP_URL` for your domain.

```bash
export CLOUDFLARE_ACCOUNT_ID=<account that owns the domain>
npm run db:migrate:demo   # migrations on the demo database
npm run db:seed:demo      # demo data now (the trigger reloads it every hour)
npm run deploy:demo       # CLOUDFLARE_ENV=demo build, then wrangler deploy
```

`db:seed:demo` only ever targets `--remote --env demo`. For your own demo, copy the block with your domain and a new database (`npx wrangler d1 create <name>`), or remove it.

## Continuous deployment

Option A — **Cloudflare Workers Builds**: connect the GitHub repository in the
dashboard (Worker → Settings → Builds). Build command `npm run build`, deploy
command `npx wrangler deploy`. Pushes to `main` deploy; other branches can get
preview URLs.

Option B — **GitHub Actions**: `.github/workflows/ci.yml` already runs checks.
Add a deploy job with `cloudflare/wrangler-action` and a `CLOUDFLARE_API_TOKEN`
secret scoped to Workers and D1.

Run remote migrations as a separate, deliberate step.

## Backups

D1 keeps 30 days of point-in-time recovery (Time Travel):

```bash
npx wrangler d1 time-travel info sistemele
npx wrangler d1 export sistemele --remote --output backup.sql   # store it somewhere private
```

## Checklist before going live

- [ ] `APP_URL`, `APP_ENV=production`, `ADMIN_EMAILS`, `EMAIL_FROM` set.
- [ ] Resend domain verified (SPF, DKIM) and `RESEND_API_KEY` set; test a sign-in email.
- [ ] Settings → Business complete (legal name, codes, address, IBAN).
- [ ] `src/worker/site/content.ts` rewritten for the business; privacy page checked.
- [ ] Turnstile secret set if the contact form gets spam.
- [ ] Custom domain attached and `APP_URL` updated.
- [ ] `https://<domain>/sitemap.xml` submitted in Google Search Console.

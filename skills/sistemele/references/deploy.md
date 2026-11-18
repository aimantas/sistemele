# Deploying

Every remote step below changes a live system: get the human's explicit go-ahead first.

0. One click instead: the README's Deploy to Cloudflare button (creates D1, asks for `ADMIN_EMAILS` and `RESEND_API_KEY` from `.dev.vars.example`, deploys with Workers Builds). Keep `.dev.vars.example` to secrets only.
1. `wrangler.jsonc`: `name`, `vars.APP_URL` (empty = the address the Worker is served from; set your https origin with a custom domain), `vars.APP_ENV = "production"`, `vars.EMAIL_FROM` (verified Resend domain).
2. `npx wrangler login`, then `npm run setup:cloudflare` (creates D1, writes `database_id`, applies migrations remotely).
3. Secrets: `npx wrangler secret put ADMIN_EMAILS` (owner emails) and `npx wrangler secret put RESEND_API_KEY` (optional `TURNSTILE_SECRET_KEY`).
4. `npm run deploy` (builds, applies D1 migrations, deploys).
5. Verify on the deployed URL: `/health`, `/`, `/sitemap.xml`, `/robots.txt`, sign in at `/app/login`, Settings → Email shows "Connected", send yourself a test sign-in.

Updates: `npm run deploy` applies new migrations before deploying.
Previews need their own D1 database and `APP_ENV` ≠ production (robots disallow).
Report each state separately: committed, pushed, deployed to <env>, verified on <url>.

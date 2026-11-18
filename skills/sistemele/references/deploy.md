# Deploying

Every remote step below changes a live system: get the human's explicit go-ahead first.

1. `wrangler.jsonc`: `name`, `vars.APP_URL` (https origin, no trailing slash), `vars.APP_ENV = "production"`, `vars.ADMIN_EMAILS`, `vars.EMAIL_FROM` (verified Resend domain).
2. `npx wrangler login`, then `npm run setup:cloudflare` (creates D1, writes `database_id`, applies migrations remotely).
3. Secrets: `npx wrangler secret put RESEND_API_KEY` (optional `TURNSTILE_SECRET_KEY`).
4. `npm run deploy`.
5. Verify on the deployed URL: `/health`, `/`, `/sitemap.xml`, `/robots.txt`, sign in at `/app/login`, Settings → Email shows "Connected", send yourself a test sign-in.

Updates: `npm run db:migrate:remote` (when `migrations/` changed) before `npm run deploy`.
Previews need their own D1 database and `APP_ENV` ≠ production (robots disallow).
Report each state separately: committed, pushed, deployed to <env>, verified on <url>.

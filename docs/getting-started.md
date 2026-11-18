# Getting started

## 1. Install

```bash
npx degit aimantas/sistemele my-business
cd my-business
npm install
npm run setup
```

`npm run setup` copies `.dev.vars.example` to `.dev.vars`, applies migrations to
a local D1 database (in `.wrangler/`) and loads fictional demo data. Use
`npm run setup -- --no-seed` for an empty database.

## 2. Run

```bash
npm run dev
```

- Public site: <http://localhost:5173/>
- Dashboard: <http://localhost:5173/app>

`npm run dev` runs Vite with the Cloudflare plugin: the real Worker runs in
workerd with the local D1, so the API, MCP endpoint and public pages behave as
in production. Nothing touches remote data.

## 3. Sign in

Open `/app/login` and enter `owner@example.com` (the default `ADMIN_EMAILS` in
`.dev.vars`). Without a Resend key the link appears on screen and in the
terminal. The first sign-in of an `ADMIN_EMAILS` address creates an owner.

## 4. Make it yours

1. `sistemele.config.ts` — modules, locale, currency, timezone, defaults.
2. Settings → Business — legal name, codes, address, bank details.
3. `src/worker/site/content.ts` — public website copy.
4. `src/app/styles.css` and `src/worker/site/styles.css` — brand colours ([DESIGN.md](../DESIGN.md)).
5. `public/favicon.svg` — your mark.
6. Delete `website/` (the Sistemėlė marketing site) and `seed/` data you do not want.

## 5. Check and deploy

```bash
npm run check     # typecheck + lint + tests
npm run build
```

Then follow [deployment.md](deployment.md).

## Useful commands

| Command | |
| --- | --- |
| `npm run db:reset` | Wipe the local database, migrate, seed. |
| `npm run module:new <id> "<Name>"` | Scaffold and register a module. |
| `npm run doctor` | Check configuration and wiring. |
| `npm run test:watch` | Tests in watch mode. |

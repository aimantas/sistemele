# Security

## Authentication

- **Passwordless sign-in.** `POST /api/auth/link` emails a one-time link valid for 15 minutes. The answer is identical, and equally fast, for unknown addresses: the token and email are written after the response. Rate-limited per IP (20/15 min, IPv6 by /64) and per email (5/15 min).
- The link opens `/app/login/verify`, which **POSTs** the token, so email scanners that prefetch links cannot consume it. Tokens are stored as SHA-256 hashes and marked used atomically (`UPDATE … RETURNING`).
- Only existing active users can sign in. Addresses in `ADMIN_EMAILS` are created as owners on first sign-in — keep that list short and remove addresses once the team exists.
- **Sessions**: random 256-bit token, stored hashed, 30-day sliding expiry; cookie `HttpOnly`, `SameSite=Lax`, `Secure` and `__Host-` prefixed on HTTPS. Sign-out deletes the session; disabling a user deletes all their sessions.
- The development shortcut that shows sign-in links on screen works only when `APP_ENV=development`, no Resend key is set, `APP_URL` is `http://` and the request comes from localhost. Email bodies (which hold sign-in and document links) are printed to the console only in development; a deployed Worker without a Resend key logs only that the email was not sent.

## Authorisation

- Roles: **owner** (everything, manages owners) > **admin** (team, settings, voids, audit) > **member** (records).
- Every service calls `ctx.requireRole(...)`; routes stay thin, so REST and MCP enforce the same rules.
- At least one active owner always remains; nobody can disable or demote themselves.

## API tokens

- `sk_…` tokens, shown once, stored hashed, revocable, with `last_used_at`.
- A request that sends an `Authorization` header is judged by that token alone; an invalid token never falls back to the session cookie.
- MCP batches are capped at 20 calls per request.
- A token's role is capped at creation and re-capped on every request to its owner's current role.
- Tokens cannot create other tokens.

## Request protection

- **CSRF**: cookie-authenticated writes must carry an `Origin` of the app (or `Sec-Fetch-Site: same-origin`). Only requests that authenticated with a valid API token are exempt (no ambient credentials). No CORS is enabled.
- **Headers**: `nosniff`, `Referrer-Policy`, `Permissions-Policy`; in non-development environments HSTS and a strict CSP on HTML (`script-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`).
- **Public endpoints** validate with Zod, rate-limit per IP, use a honeypot field, and optionally Cloudflare Turnstile (`TURNSTILE_SECRET_KEY`). The contact form answers the same for new and known addresses, so it never reveals who is in the CRM.
- **Email caps**: 100 emails an hour per signed-in person, 300 an hour for automatic emails (such as website-form notifications); sign-in links have their own limits. Line breaks never reach a subject.
- **SVG logos** are only shown through `<img>` and served with a sandboxing CSP; the upload also refuses namespaced elements, encoded attributes, `@import` and CDATA.
- **Private document links** (`/q/:token`, `/i/:token`) use 256-bit random tokens stored hashed; re-sending rotates the token; pages are `noindex` and `Cache-Control: private, no-store`.
- SQL is always parameterised; `LIKE` input is escaped.

## Data integrity

- Server-authoritative totals; client totals are ignored.
- Issued invoices are immutable; numbering is gap-free inside one D1 transaction, and in date order: an issue date cannot be in the future, more than 31 days back, or before the last issued invoice.
- Document totals are capped (100 billion in cents) so every amount stays a safe integer.
- What the public site shows is published by owners and admins: content pages and posts, and public products (members can keep products off the website).
- Every write is in `audit_log` with the actor (or "Public").

## Public demo

Demo mode (`DEMO_MODE=1`) makes every visitor the shared owner, so it is
fenced in:

- It needs `APP_ENV=demo` as well; one stray variable on a production Worker does nothing.
- The hourly reset wipes a database only if it holds the seed's `demo_data` marker.
- Settings (business, brand) are read-only; email is never sent.
- Pages, posts and products visitors publish are `noindex`, left out of the sitemap, the menu and the home page, and their links are `nofollow ugc`.
- The contact form says that anyone using the demo can read what is sent.

## Security review (21 Nov 2026)

A review of authentication, authorisation, injection and output encoding, and
configuration and dependencies found no critical or high-severity issue in a
normal deployment. Fixed: email bodies in production logs, timing differences
on sign-in, the bearer-header CSRF exemption, demo misconfiguration and abuse,
backdated invoice numbers, member-published products, contact-form address
probing, unbounded MCP batches and email sending, the last-owner race, SVG
sanitiser gaps, unsafe integer totals, unvalidated sign-in redirects, missing
audit entries, rate-limit keys and table growth, and a vulnerable test-only
dependency. `tests/security.test.ts` pins each fix.

Known limits, accepted for now:

- Sessions slide for 30 days with no absolute cap and no "sign out everywhere"; disabling a user is the kill switch.
- `ADMIN_EMAILS` addresses become owners whenever they first sign in: remove them once the team exists (checklist below).
- API tokens have no read-only scope or expiry; give agents the lowest role that works and revoke unused tokens.
- An admin's publish does not check that a member's draft is unchanged since review.
- Members can embed images from any https address in content (tracking pixels).

## Hardening checklist

- [ ] Set `RESEND_API_KEY` before going live (without it, sign-in links cannot reach anyone) and `APP_URL` to your https address.
- [ ] Remove addresses from `ADMIN_EMAILS` once owners exist.
- [ ] Never put `DEMO_MODE` on a production Worker, and never give a demo environment your production `database_id`.
- [ ] Resend key with sending access only; Cloudflare API tokens scoped to the minimum.
- [ ] Turnstile on public forms if you get spam.
- [ ] Separate D1 databases for preview and production.
- [ ] Review Settings → Audit log and revoke unused API tokens regularly.
- [ ] Enable Cloudflare WAF/bot rules on the zone for public endpoints if traffic grows.

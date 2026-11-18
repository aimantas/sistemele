# Security

## Authentication

- **Passwordless sign-in.** `POST /api/auth/link` emails a one-time link valid for 15 minutes. The answer is identical for unknown addresses. Rate-limited per IP (20/15 min) and per email (5/15 min).
- The link opens `/app/login/verify`, which **POSTs** the token, so email scanners that prefetch links cannot consume it. Tokens are stored as SHA-256 hashes and marked used atomically (`UPDATE … RETURNING`).
- Only existing active users can sign in. Addresses in `ADMIN_EMAILS` are created as owners on first sign-in — keep that list short and remove addresses once the team exists.
- **Sessions**: random 256-bit token, stored hashed, 30-day sliding expiry; cookie `HttpOnly`, `SameSite=Lax`, `Secure` and `__Host-` prefixed on HTTPS. Sign-out deletes the session; disabling a user deletes all their sessions.
- The development shortcut that shows sign-in links on screen works only when `APP_ENV=development`, no Resend key is set, `APP_URL` is `http://` and the request comes from localhost.

## Authorisation

- Roles: **owner** (everything, manages owners) > **admin** (team, settings, voids, audit) > **member** (records).
- Every service calls `ctx.requireRole(...)`; routes stay thin, so REST and MCP enforce the same rules.
- At least one active owner always remains; nobody can disable or demote themselves.

## API tokens

- `sk_…` tokens, shown once, stored hashed, revocable, with `last_used_at`.
- A token's role is capped at creation and re-capped on every request to its owner's current role.
- Tokens cannot create other tokens.

## Request protection

- **CSRF**: cookie-authenticated writes must carry an `Origin` of the app (or `Sec-Fetch-Site: same-origin`). Bearer-token requests are exempt (no ambient credentials). No CORS is enabled.
- **Headers**: `nosniff`, `Referrer-Policy`, `Permissions-Policy`; in non-development environments HSTS and a strict CSP on HTML (`script-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`).
- **Public endpoints** validate with Zod, rate-limit per IP, use a honeypot field, and optionally Cloudflare Turnstile (`TURNSTILE_SECRET_KEY`).
- **Private document links** (`/q/:token`, `/i/:token`) use 256-bit random tokens stored hashed; re-sending rotates the token; pages are `noindex` and `Cache-Control: private, no-store`.
- SQL is always parameterised; `LIKE` input is escaped.

## Data integrity

- Server-authoritative totals; client totals are ignored.
- Issued invoices are immutable; numbering is gap-free inside one D1 transaction.
- Every write is in `audit_log` with the actor (or "Public").

## Hardening checklist

- [ ] Remove addresses from `ADMIN_EMAILS` once owners exist.
- [ ] Resend key with sending access only; Cloudflare API tokens scoped to the minimum.
- [ ] Turnstile on public forms if you get spam.
- [ ] Separate D1 databases for preview and production.
- [ ] Review Settings → Audit log and revoke unused API tokens regularly.
- [ ] Enable Cloudflare WAF/bot rules on the zone for public endpoints if traffic grows.

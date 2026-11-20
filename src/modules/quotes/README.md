# Quotes module

Priced offers for CRM contacts. Staff build a quote from line items, send it,
and the customer opens a private link to accept or decline. Acceptance moves
the linked deal to **won** and, with the invoices module on, turns into an
invoice in one click.

- Requires: `crm` (contacts and deals). Set in `requires`.
- Server: `server/index.ts` (module), `service.ts` (all rules), `routes.ts`
  (REST + public answers), `site.tsx` (`/q/:token`), `tools.ts` (MCP).
- Shared: `shared/schema.ts` (Zod input schemas, types, status helpers).
- Client: `client/index.tsx` (nav, routes, widget, quick action) and lazy pages.
- Developer panel (dev mode): `client/dev.ts` lists each page's files, MCP tools and starter prompts for a coding agent; `tests/dev-panel.test.ts` checks it.
- Tests: `tests/quotes.test.ts`. Demo data: `seed/04_quotes.sql`.

## Statuses

| Status     | Stored? | Meaning                                                                 |
| ---------- | ------- | ----------------------------------------------------------------------- |
| `draft`    | yes     | Being prepared. The only editable and deletable state.                 |
| `sent`     | yes     | Emailed with a private link; waiting for the customer.                  |
| `expired`  | no      | Derived: stored `sent` and `valid_until` is before today (business time zone). Cannot be accepted. |
| `accepted` | yes     | Customer (or staff on their behalf) accepted. Locked.                    |
| `declined` | yes     | Customer (or staff) declined. Locked.                                    |

Transitions: `draft → sent` (send), `sent → sent` (send again: new link, old
one stops working), `sent | expired → draft` (revise: clears the link),
`sent → accepted | declined` (customer link or staff), `draft | expired →
accepted | declined` (staff override only). Accepted and declined quotes are
never edited; duplicate them to make a new offer.

API responses always report the derived status, so `status: "expired"` is
visible everywhere while the row stays `sent`.

## Numbers and money

- Number: `nextDocumentNumber(db, business.quotePrefix, year of issue date)`,
  e.g. `Q-2026-0007`. Gaps after a failed write are acceptable for quotes.
- Defaults: issue date = today in `config.timezone`, valid until = issue date
  + 30 days, currency = business currency, line VAT = business
  `defaultVatRateBps` when `vatRateBps` is left out.
- Money is integer cents, VAT and discounts are basis points. The server prices
  every line with `priceLines` from `src/shared/lines.ts`; any totals a client
  sends are ignored.

## Tables (`migrations/0004_quotes.sql`)

- `quotes`: number, contact, optional deal, status, dates, currency, stored
  totals, notes, terms, `public_token_hash` (SHA-256 of the customer link
  token; the token itself is never stored), `sent_at`, `responded_at`.
- `quote_lines`: position, optional product, description, quantity, unit,
  unit price, VAT, discount, computed net.
- `invoices.quote_id` (owned by the invoices module) links an invoice back.

## REST API (`/api/quotes`, signed in, role member+)

| Method | Path              | Body / query                                                                     | Result |
| ------ | ----------------- | -------------------------------------------------------------------------------- | ------ |
| GET    | `/`               | `status` (draft, sent, accepted, declined, expired, or `awaiting` = sent + expired, oldest sent first), `contactId`, `dealId`, `q` (number or contact name), `limit`, `offset` | `{ items, total }` with `contactName`, `dealTitle` |
| POST   | `/`               | `{ contactId, dealId?, issueDate?, validUntil?, notes, terms, lines }`          | `201` quote detail |
| GET    | `/:id`            |                                                                                  | quote + `lines`, `vatGroups`, `contact`, `seller`, `buyer`, `invoiceId` |
| PATCH  | `/:id`            | any create field; `lines` replaces all lines                                    | detail; `409` unless draft |
| DELETE | `/:id`            |                                                                                  | `{ ok }`; `409` unless draft |
| POST   | `/:id/send`       | `{ message? }`                                                                   | `{ quote, publicUrl, emailStatus }`; `422` without contact email or with a past valid-until date |
| POST   | `/:id/revise`     |                                                                                  | detail (draft, link cleared) |
| POST   | `/:id/mark`       | `{ status: "accepted" \| "declined" }`                                           | detail; emits the event |
| POST   | `/:id/duplicate`  |                                                                                  | `201` new draft |

Validation errors are `422` with `error.issues` keyed by path, e.g.
`lines.0.quantity`, `contactId`, `validUntil`.

`publicUrl` is returned only by `send`, because only its hash is stored. Staff
copy it right after sending; "Send again" makes a new one.

## Customer side (no sign-in)

- `GET /q/:token`: the quote rendered with `DocumentView` (seller from the
  business profile, buyer from the contact), `noindex` and `no-store`. Sent and
  unexpired quotes show two plain HTML forms (no JavaScript). `?done=accepted|declined`
  shows the result; unknown or revoked tokens get a 404 page. Also answers
  `Accept: text/markdown` for agents.
- `POST /api/public/quotes/:token/accept` and `/decline`: form posts get a
  `303` back to `/q/:token?done=…` (or `?error=closed|rate_limited`), JSON gets
  `{ ok, status, number }`. Rate-limited to 20 answers per IP per hour.
  Repeating the same answer is a no-op; a different answer on a closed quote is
  `409`. Sets `responded_at`, emits the event and emails the business address
  (Settings → Business) when one is set.

The token is the only permission: 32 random bytes, looked up by hash, so one
link never reveals another quote.

## Events (`src/modules/events.ts`)

| Emitted          | When                                  | CRM reaction                                   |
| ---------------- | ------------------------------------- | ---------------------------------------------- |
| `quote.sent`     | every send (including send again)     | deal lead/qualified → proposal, timeline entry |
| `quote.accepted` | customer link or staff mark           | deal → won (value set if 0), timeline entry    |
| `quote.declined` | customer link or staff mark           | timeline entry                                 |

## MCP tools

`quotes_list`, `quotes_get`, `quotes_create` (lines in cents and bps; VAT
optional), `quotes_update_draft`, `quotes_send` (returns the private link),
`quotes_mark`. Revise, duplicate and delete stay in the dashboard on purpose.

## Metrics and widgets

- `quotes.open_value` (money): total of sent, unexpired quotes; hint
  "N awaiting answer".
- `quotes.acceptance_rate_90d` (percent): accepted ÷ (accepted + declined)
  answered in the last 90 days.
- Widget `quotes.awaiting`: sent quotes oldest first with days waiting and
  expiry warnings (3 days or less, or expired). Used by the Sales template.

## Search and navigation

Global search matches quote number and contact name and links to
`/app/quotes/:id`. Dashboard routes: `/app/quotes` (status tabs, search),
`/app/quotes/new?contactId=&dealId=` (prefilled editor), `/app/quotes/:id`
(preview, send, copy link, revise, mark, duplicate, print, delete draft,
create invoice), `/app/quotes/:id/edit`. Quick action: "New quote".

## Invoices

When the `invoices` module is enabled, an accepted quote shows **Create
invoice**, which calls `POST /api/invoices/from-quote/:quoteId` (owned by the
invoices module) and opens `/app/invoices/:id`. Once a non-void invoice points
at the quote, `GET /api/quotes/:id` returns its `invoiceId` and the button
becomes **Open invoice**.

## Extending

- New statuses: add to `QUOTE_STATUSES`, the migration `CHECK`, the guards in
  `service.ts` and the badge tones in `client/parts.tsx`.
- Per-customer validity or terms: read them from the contact in
  `createQuote` before the defaults.
- Seller/buyer snapshots: quotes print the live business profile and contact.
  If quotes must freeze them like invoices, add `seller`/`buyer` JSON columns
  in a new migration and fill them on send.
- Keep every rule in `service.ts`; routes and tools stay thin wrappers.

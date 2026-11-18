# Invoices module

Numbered VAT invoices: drafts, issuing with gap-free numbers, emailing a
private link, payments, overdue tracking and voiding. Requires `crm`
(every invoice belongs to a contact). Tables: `migrations/0005_invoices.sql`.

## Lifecycle

| Status | Number | Editable | How it gets there |
| --- | --- | --- | --- |
| `draft` | none | yes (PATCH, DELETE) | `POST /api/invoices` or `POST /api/invoices/from-quote/:quoteId` |
| `issued` | `INV-2026-0001` | no | `POST /:id/issue` |
| `paid` | kept | no | payments reach the total |
| `void` | kept (never reused) | no | `POST /:id/void` (admin, reason required) |

"Overdue" is derived, never stored: `status = 'issued' AND due_date < today`
(today in `config.timezone`). API items carry `overdue`, `daysOverdue` and
`amountDueCents` (0 for paid and void).

Rules the service enforces (`server/service.ts`):

- **Totals are server-side.** Lines go through `priceLines()`; client totals are ignored.
- **Gap-free numbering.** Issuing runs one `db.batch`: a guard statement that aborts
  the whole batch unless the invoice is still a draft, `gapFreeNumberStatements()`,
  and the status update. A repeated or concurrent issue returns 409 and never
  consumes or rewrites a number (tested with a forced race).
- **Snapshots on issue.** `seller` (business profile plus `bank: { name, iban }`
  and `footer`) and `buyer` (contact) are stored as JSON so later edits never
  rewrite an issued invoice. Drafts show a live preview instead.
- **Issued invoices are immutable.** PATCH/DELETE return 409. Correct with void + new invoice.
- **Payments** only on `issued`; more than the amount due is 422. `paid_cents` is
  recomputed from `invoice_payments` in the same batch. Deleting a payment (admin)
  can move `paid` back to `issued`.
- **One live invoice per quote** (partial unique index). A second
  `from-quote` returns 409 with `{ error, invoiceId }` naming the existing invoice.
  Only `accepted` quotes can be invoiced (422 otherwise).
- **Customer links** are `randomToken()` values stored as `sha256Hex` in
  `public_token_hash`. Each send replaces the previous link.

## API (`/api/invoices`, signed in)

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/` | member | `status` (draft, issued, overdue, paid, void), `contactId`, `q` (number or contact), `limit`, `offset` → `{ items, total }` |
| POST | `/` | member | `{ contactId, dueDate?, notes, lines }` → draft (201) |
| POST | `/from-quote/:quoteId` | member | draft from an accepted quote (201) |
| GET | `/:id` | member | invoice + lines + `vatGroups` + payments + contact + `quoteNumber` + seller/buyer + `hasPublicLink` |
| PATCH | `/:id` | member | drafts only; only the fields sent change |
| DELETE | `/:id` | member | drafts only |
| POST | `/:id/issue` | member | `{ issueDate?, dueDate?, send? }` → `{ invoice, publicUrl }` |
| POST | `/:id/send` | member | needs a contact email (422) → `{ invoice, publicUrl, emailStatus }` |
| POST | `/:id/payments` | member | `{ amountCents, paidOn, method, reference }` |
| DELETE | `/:id/payments/:paymentId` | admin | |
| POST | `/:id/void` | admin | `{ reason }` |

Every write is audited (`invoice.created`, `.updated`, `.deleted`, `.issued`,
`.sent`, `.payment_recorded`, `.paid`, `.payment_deleted`, `.voided`).

## Public page

`GET /i/:token` (`server/site.tsx`): `DocumentView` with the snapshots, issue
and due dates, Paid and Amount due rows, a bank transfer block (bank, IBAN,
reference = invoice number, amount due) while issued and an IBAN is set, a Paid
or Void state, and a print hint. `noindex`, no JavaScript, Markdown for agents.
Unknown or malformed tokens get the 404 page.

## Events

Emitted (payloads in `src/modules/events.ts`): `invoice.issued` (with
`lines: { productId, quantity }[]` for stock), `invoice.paid`,
`invoice.voided` (with lines, to reverse stock). Handled by none here; CRM
writes the timeline, catalog moves stock.

## Dashboard, search, MCP

- Metrics: `invoices.revenue_30d` (issued + paid dated in the last 30 days),
  `invoices.outstanding` (owed on issued), `invoices.overdue_amount`.
- Widget: `invoices.overdue` (number, contact, days overdue, amount due).
- Search: invoice number and contact name → `/app/invoices/:id`.
- MCP tools: `invoices_list`, `invoices_get`, `invoices_create_draft`,
  `invoices_create_from_quote`, `invoices_issue`, `invoices_send`,
  `invoices_record_payment`.

## Screens (`client/`)

`/app/invoices` (status tabs, search), `/app/invoices/new` (`?contactId=`
prefill), `/app/invoices/:id` (document, Issue, Send, Copy link, Record
payment, Payments, Void, Print, Delete draft), `/app/invoices/:id/edit`.
Quick action: New invoice.

## Seed and tests

`seed/05_invoices.sql`: one overdue, one paid (from quote `qt_demo_2`, with a
payment), one issued and not yet due, one draft; sequence set to 3.
`tests/invoices.test.ts` covers totals, numbering (including a forced race),
locking, PATCH semantics, payments, void permissions, overdue, from-quote,
sending, the public page and MCP.

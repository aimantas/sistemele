# CRM

Customers and leads, a drag-and-drop deal pipeline, a timeline of notes, calls,
emails, meetings and tasks, and website requests that arrive as leads. The
reference implementation for every other module.

| | |
| --- | --- |
| Tables | `contacts`, `deals`, `activities` (`migrations/0002_crm.sql`) |
| Requires | — |
| Public | `POST /api/public/crm/inquiries` (HTML form → 303, or JSON → 201), used by `/contact` |

## API (`/api/crm`, signed in)

| Method | Path | |
| --- | --- | --- |
| GET | `/contacts?q=&tag=&limit=&offset=` | `{ items, total }`, newest activity first |
| POST | `/contacts` | Create (`contactInputSchema`) |
| GET | `/contacts/:id` | `{ contact, deals, activities }` |
| PATCH | `/contacts/:id` | Partial update |
| DELETE | `/contacts/:id` | Archive (records that reference it stay) |
| GET | `/deals?stage=&contactId=` | `{ items }` |
| POST | `/deals` | Create (`dealInputSchema`) |
| GET/PATCH | `/deals/:id` | Read / update |
| POST | `/deals/:id/move` | `{ stage, position }` — the pipeline board's drag and drop |
| GET | `/activities?contactId=&dealId=&open=1` | Timeline or open tasks |
| POST | `/activities` | Note, call, email, meeting or task (`dueAt`) |
| POST | `/activities/:id/complete` | Complete a task |

## MCP tools

`crm_list_contacts`, `crm_get_contact`, `crm_create_contact`, `crm_update_contact`,
`crm_list_deals`, `crm_create_deal`, `crm_move_deal`, `crm_add_activity`,
`crm_list_open_tasks`.

## Metrics and widgets

- Metrics: `crm.open_pipeline_value`, `crm.new_contacts_30d`, `crm.win_rate_90d`, `crm.open_tasks`.
- Widgets: `crm.pipeline`, `crm.open-tasks`, `crm.recent-contacts`.
- Exports for other modules (`requires: ["crm"]`): `client/ContactPicker.tsx`, `client/api.ts` hooks, `shared/schema.ts` types.

## Events

- Emits `contact.created`, `deal.stage_changed`.
- Handles `quote.sent` (deal → proposal), `quote.accepted` (deal → won, value filled if empty), `quote.declined`, `invoice.issued`, `invoice.paid` — each adds a system entry to the timeline.

## Rules

- Website requests reuse the contact with the same email (case-insensitive), open a `lead` deal, store the message on the timeline and email the business address from Settings.
- Pipeline positions are fractional; a move writes one row. Moving to won/lost sets `closed_at`; moving back clears it.
- Archived contacts disappear from lists and search but keep their history.

## Extending

- More pipeline stages: edit `DEAL_STAGES` in `shared/schema.ts` **and** the CHECK constraint (new migration that rebuilds `deals`).
- Custom fields: add columns in a new migration, extend `contactInputSchema`, `CONTACT_COLUMNS`, `CONTACT_FIELD_COLUMNS` and the form.
- Reacting to `stock.low` (e.g. create a task for the purchaser): add a handler in `server/index.ts` `events`.

# CRM

A leads inbox, customers (contacts), a drag-and-drop deal pipeline with your
own stages, and a timeline of notes, calls, emails, meetings and tasks. Website
messages arrive as leads. The reference implementation for every other module.

| | |
| --- | --- |
| Tables | `leads`, `contacts`, `deals`, `pipeline_stages`, `activities` (`migrations/0002_crm.sql`, `0007_crm_leads_stages.sql`) |
| Requires | — |
| Public | `POST /api/public/crm/inquiries` (HTML form → 303, or JSON → 201 with `reference` = lead id), used by `/contact` |
| Server files | `server/leads.ts` (leads, inquiries), `server/service.ts` (contacts, deals, timeline), `server/stages.ts` (pipeline stages) |

## Lead → customer

1. A lead arrives (`new`): the contact form, `crm_create_lead`, or New lead in the dashboard. Leads have a source, an owner, an estimated value and a follow-up date.
2. Work it: logging a call, email or meeting on a new lead marks it `contacted`; set `qualified` when it fits.
3. Close it: **convert** (reuses the contact with the same email or creates one, opens a deal in the first open stage unless told otherwise, moves the lead's timeline to them) or **disqualify** with a reason. Disqualified leads can be reopened; converted leads are read-only.

## Pipeline stages

Owners and admins edit stages in Pipeline → Stages (or with the stage tools).
Open stages can be added, renamed, reordered and removed (their deals move to
a stage you pick). Exactly one won and one lost stage always exist; they can be
renamed. Each open stage has a win probability in basis points that weights the
pipeline. Stage ids are permanent slugs made from the first name
(`demo-booked`); deals store the id.

Defaults: Qualified 20%, Proposal 50%, Negotiation 80%, Won, Lost.

## API (`/api/crm`, signed in)

| Method | Path | |
| --- | --- | --- |
| GET | `/leads?status=&ownerId=&source=&q=&due=1&limit=&offset=` | `{ items, total, counts }`. `status`: open (default), new, contacted, qualified, disqualified, converted, all. `ownerId`: a user id, `me` or `none`. `due=1`: open leads with a follow-up today or earlier. |
| POST | `/leads` | Create (`leadInputSchema`); without `ownerId` the creator owns it |
| GET | `/leads/:id` | `{ lead, activities, matchingContact }` |
| PATCH | `/leads/:id` | Partial update, including `status` (disqualifying needs `disqualifyReason`) |
| POST | `/leads/:id/convert` | `{ contactId?, createDeal?, dealTitle?, valueCents?, stage? }` → `{ lead, contact, deal }` |
| GET | `/contacts?q=&tag=&limit=&offset=` | `{ items, total }`, newest activity first |
| POST | `/contacts` | Create (`contactInputSchema`) |
| GET | `/contacts/:id` | `{ contact, deals, activities, leads }` |
| PATCH | `/contacts/:id` | Partial update |
| DELETE | `/contacts/:id` | Archive (records that reference it stay) |
| GET | `/stages` | `{ items }` in board order, with deal count and value |
| POST | `/stages` | Add an open stage (`label`, `probabilityBps`). Admin |
| PATCH | `/stages/:id` | Rename or change probability. Admin |
| POST | `/stages/order` | `{ ids }`: every open stage once, in the new order. Admin |
| DELETE | `/stages/:id?moveTo=` | Remove an open stage; `moveTo` required when it has deals. Admin |
| GET | `/deals?stage=&contactId=&ownerId=&status=` | `{ items }` with `stageLabel`, `stageKind`, `probabilityBps`, `ownerName`. `status`: open, won, lost |
| POST | `/deals` | Create (`dealInputSchema`); stage defaults to the first open stage, owner to the creator |
| GET/PATCH | `/deals/:id` | Read / update (title, value, close date, owner, stage, lost reason) |
| POST | `/deals/:id/move` | `{ stage, position, lostReason? }` — the board's drag and drop |
| GET | `/activities?contactId=&dealId=&leadId=&open=1` | Timeline or open tasks |
| POST | `/activities` | Note, call, email, meeting or task (`dueAt`) on a lead, contact or deal |
| POST | `/activities/:id/complete` | Complete a task |

Owner pickers read the core `GET /api/team` (active users).

## MCP tools

Leads: `crm_list_leads`, `crm_get_lead`, `crm_create_lead`, `crm_update_lead`, `crm_convert_lead`.
Contacts: `crm_list_contacts`, `crm_get_contact`, `crm_create_contact`, `crm_update_contact`.
Pipeline: `crm_list_stages`, `crm_create_stage` (admin), `crm_update_stage` (admin), `crm_list_deals`, `crm_create_deal`, `crm_update_deal`, `crm_move_deal`.
Timeline: `crm_add_activity`, `crm_list_open_tasks`. Team members for `ownerId`: core `core_list_team`.

## Metrics and widgets

- Metrics: `crm.open_pipeline_value`, `crm.weighted_pipeline_value`, `crm.open_leads`, `crm.new_leads_30d`, `crm.lead_conversion_90d`, `crm.new_contacts_30d`, `crm.win_rate_90d`, `crm.open_tasks`.
- Widgets: `crm.leads`, `crm.pipeline`, `crm.open-tasks`, `crm.recent-contacts`.
- Exports for other modules (`requires: ["crm"]`): `client/ContactPicker.tsx`, `client/parts.tsx` (`OwnerSelect`, `Timeline`), `client/api.ts` hooks, `shared/schema.ts` types.

## Events

- Emits `lead.created`, `lead.converted`, `contact.created`, `deal.stage_changed`.
- Handles `quote.sent` (deal → `proposal` when that stage exists and the deal is in an earlier open stage), `quote.accepted` (deal → the won stage, value filled if empty), `quote.declined`, `invoice.issued`, `invoice.paid` — each adds a system entry to the timeline.

## Rules

- A website message from an email with an open lead adds a note to that lead instead of a new lead. Staff get an email at the business address from Settings.
- Status changes on a lead are written to its timeline as system entries.
- Pipeline positions are fractional; a move writes one row. Moving to a won or lost stage sets `closed_at`; moving back clears it and the lost reason.
- Archived contacts disappear from lists and search but keep their history.

## Extending

- More lead fields: add columns in a new migration, extend `leadInputSchema`, `LEAD_SELECT`, `LEAD_FIELD_COLUMNS` (`server/leads.ts`) and `LeadForm.tsx`.
- More lead sources: add to `LEAD_SOURCES` in `shared/schema.ts` (the column is free text, validated by the schema).
- Custom contact fields: add columns in a new migration, extend `contactInputSchema`, `CONTACT_COLUMNS`, `CONTACT_FIELD_COLUMNS` and the form.
- Reacting to a won deal or a converted lead (e.g. a delivery task): handle `deal.stage_changed` or `lead.converted` in your module's `events`.

# Roadmap

Planned, roughly in order. Contributions welcome — open an issue first for anything large.

| Item | Notes |
| --- | --- |
| **Lithuanian and other UI languages** | Message catalogue per module; locale switch per user. |
| **Files on R2** | Attachments for contacts, quotes and invoices; product images upload. |
| **PDF invoices** | Server-side PDF (or Browser Rendering) attached to invoice emails. |
| **Webhooks & automations** | Outgoing webhooks for every event; simple "when X then Y" rules (e.g. stock.low → task). |
| **Payments module** | Provider adapters (Stripe, Montonio, Paysera) with signed webhooks, idempotency and reconciliation; bank transfer stays default. |
| **Bookings module** | Services, staff calendars, public booking page, reminders. |
| **Purchasing** | Suppliers, purchase orders, receiving into stock. |
| **Shop module** | Public cart and checkout for catalog products (server-authoritative totals, stock reservations). |
| **Accounting export** | CSV/XML exports for common accounting tools; i.SAF for Lithuania. |
| **Dark mode** | Tokens are ready; needs a second palette and a toggle. |
| **Multi-tenant mode** | One deployment for many businesses (tenant id on every table, per-tenant D1 or row-level). |
| **Scheduled jobs** | Cron Trigger for quote expiry reminders and overdue invoice reminders. |

# Product

## Who it is for

1. **Small businesses** (1–30 people) that sell products or services B2B and today juggle spreadsheets, an invoicing tool, email and a website builder. They want one fast system they own.
2. **Developers and agencies** who build such systems for clients and want a solid, modern starting point instead of a CMS plugin stack.
3. **AI coding agents** working for either of the above. The codebase is written so an agent can add a module, a widget or a page safely.

## Jobs

- Capture requests from the website and follow them up.
- Price work with quotes the customer can accept online.
- Invoice correctly (numbering, VAT, immutability) and see who owes what.
- Know what is in stock and what to reorder.
- Publish website pages and blog posts without a developer, with drafts an agent can write and a person approves.
- See the business at a glance on a dashboard each person arranges for themselves.
- Let AI agents read and act on business data with scoped permissions.

## Principles

- **Own your code and data.** One Worker, one D1 database, MIT licence. No vendor-controlled SaaS in the critical path.
- **Correct before clever.** Money in cents, server-authoritative totals, immutable issued invoices, audit trail.
- **Modules, not a monolith.** Each capability is a folder with a clear contract; switching one off removes its routes, screens, widgets and tools.
- **Fast and indexable public pages.** Server-rendered HTML, no client JavaScript, structured data only for real facts.
- **Agent-ready.** Every capability has a typed service, an API route and an MCP tool; docs are written for agents as much as for people.

## Non-goals (for now)

- Multi-tenant SaaS hosting (one deployment per business; see roadmap).
- Full accounting (ledgers, tax returns). Invoices export cleanly to accounting tools instead.
- Online card payments in the core. Bank transfer is the default; payment providers are separate modules.

## Success measures

- A developer goes from clone to a deployed, signed-in system in under 15 minutes.
- An agent adds a working module (migration, API, MCP tools, screens, tests) following `AGENTS.md` without human fixes to the architecture.
- Public pages score 95+ on Lighthouse performance and SEO on mobile.

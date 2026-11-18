# Product

## Motto

**Don't ask your agent to reinvent the wheel.**

Sistemėlė is a practical starter kit and admin panel for AI-native projects. The common wheels (sign-in, roles, audit, CRM, quotes, invoices,
stock, website, dashboard, MCP) are built, tested and documented, so an agent
spends its effort on what is specific to the business.

## Who it is for

1. **AI coding agents** (Claude Code, Codex, Cursor …) asked to build or extend a business system. `AGENTS.md`, module READMEs, the skill and `docs/extending.md` tell them what exists and how to add to it safely.
2. **Developers and agencies** who direct those agents and want a small, modern, owned starting point instead of a SaaS or a CMS plugin stack.
3. **Small businesses** (1–30 people) that sell products or services B2B and get one fast system they own, set up by either of the above.

## Jobs

- Capture requests as leads, assign and follow them up, convert the good ones into deals on a pipeline whose stages fit the business.
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
- **Reuse over reinvention.** Every capability has a typed service, an API route and an MCP tool; docs are written for agents as much as for people. New work extends an existing module or follows the CRM module's shape.
- **Simple.** Few dependencies, plain SQL, one Worker. An agent should understand a module by reading its folder.

## Non-goals (for now)

- Multi-tenant SaaS hosting (one deployment per business; see roadmap).
- Full accounting (ledgers, tax returns). Invoices export cleanly to accounting tools instead.
- Online card payments in the core. Bank transfer is the default; payment providers are separate modules.

## Success measures

- A developer goes from clone to a deployed, signed-in system in under 15 minutes.
- An agent adds a working module (migration, API, MCP tools, screens, tests) following `AGENTS.md` without human fixes to the architecture.
- Public pages score 95+ on Lighthouse performance and SEO on mobile.

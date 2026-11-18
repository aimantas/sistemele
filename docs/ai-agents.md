# AI agents

Sistemėlė is a practical starter kit and admin panel for AI-native projects: coding agents extend it, and AI agents operate a running installation. Don't ask them to reinvent the wheel; point them at what exists. Best practices for extending: [extending.md](extending.md).

## 1. Agents that change the code

| Agent | Reads |
| --- | --- |
| Codex, Cursor, Copilot, Gemini CLI … | `AGENTS.md` |
| Claude Code | `CLAUDE.md` → `AGENTS.md`, project skill `.claude/skills/sistemele`, commands in `.claude/commands/` |
| Any skills-compatible agent | `npx skills add aimantas/sistemele` installs `skills/sistemele` |

Every module has a README with its tables, API, tools, metrics, widgets and
events, so an agent can work on one module without reading the whole repo.

Claude Code commands:

| Command | Does |
| --- | --- |
| `/new-module <id> <Name>` | Scaffolds, implements and tests a module end to end. |
| `/add-widget <module> <description>` | Adds a dashboard widget (+ endpoint/metric if needed). |
| `/add-dashboard-template <name> <purpose>` | Adds a template from existing widgets and metrics. |
| `/add-mcp-tool <module> <description>` | Adds a service-backed MCP tool with a test. |
| `/seo-check` | Audits public pages against docs/seo.md. |
| `/ship-check` | Runs typecheck, lint, tests, build and reports delivery state. |

## 2. Agents that use a running system (MCP)

`POST /mcp` speaks the Model Context Protocol (Streamable HTTP, stateless,
JSON responses). Authenticate with an API token from **Settings → API & agents**.
The token's role (member/admin/owner) caps what the agent can do; it can never
exceed its owner's role. Revoke tokens there at any time.

**Claude Code**

```bash
claude mcp add --transport http sistemele https://your-domain/mcp --header "Authorization: Bearer sk_…"
```

**Claude Desktop / Cursor / other clients** (`mcp.json`):

```json
{
  "mcpServers": {
    "sistemele": {
      "type": "http",
      "url": "https://your-domain/mcp",
      "headers": { "Authorization": "Bearer sk_…" }
    }
  }
}
```

Tools come from enabled modules (`core_*`, `crm_*`, `catalog_*`, `quotes_*`,
`invoices_*`, `content_*`). `GET /llms.txt` lists them with descriptions. Things an agent
can do once connected:

- “Go through this week's new leads, mark the spam disqualified, assign the rest to me with a follow-up date, and convert the ones that asked for a price into deals.”
- “Find everyone who asked for a quote this week and draft quotes from our price list.”
- “Which invoices are overdue more than 14 days? Add a follow-up task for each customer.”
- “Receive 200 pcs of SKU BR-12 into stock and tell me what is still below reorder point.”
- “Draft a blog post answering the three questions customers asked most this month.” (A member token drafts; an owner or admin publishes it in Website → Posts.)

Writes are audited under the token owner's name, with the token's role.

## 3. Agents reading the public site

- `GET /llms.txt` — what the business offers and how to send a request.
- Any public page with `Accept: text/markdown` returns Markdown.
- `POST /api/public/crm/inquiries` (JSON: name, email, phone, company, message) sends a message that arrives as a lead — the same as the contact form.

## Writing tools well

- Name: `<module>_<verb>_<noun>`. Description: what it does, when to use it, units (cents, bps, YYYY-MM-DD), what it returns.
- Wrap a service; never put SQL in a tool.
- Mark read-only tools `readOnly: true`. Use `minRole` for admin actions.
- Return plain JSON objects; errors become `isError` results with field messages.

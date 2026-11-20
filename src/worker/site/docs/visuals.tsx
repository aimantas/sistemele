import type { ServerModule } from "@/modules/types.server";
import { coreTools } from "../../mcp/core-tools";
import { escapeHtml, renderDocMarkdown } from "./markdown";
import { findDoc } from "./sources";

/**
 * Diagrams and charts for /docs. Server-rendered HTML and CSS (no client
 * JavaScript, no images): they reflow on phones, follow light and dark, and
 * read as text for screen readers and agents. Every number comes from the
 * running code (enabled modules, their tools) or from AGENTS.md itself.
 */

/** One Worker serves everyone: who calls it, what it serves, where data goes. */
export function ArchitectureDiagram({ modules }: { modules: readonly ServerModule[] }) {
  return (
    <figure className="dv dv-arch" aria-labelledby="dv-arch-caption">
      <div className="dv-arch-col">
        <p className="dv-label">Who uses it</p>
        <ul className="plain dv-stack">
          <li className="dv-node">
            <strong>Visitors</strong>
            <span>Website, contact form, quote and invoice links</span>
          </li>
          <li className="dv-node">
            <strong>Your team</strong>
            <span>Admin panel in the browser</span>
          </li>
          <li className="dv-node">
            <strong>AI agents</strong>
            <span>MCP tools with an API token</span>
          </li>
        </ul>
      </div>
      <div className="dv-arrow" aria-hidden="true" />
      <div className="dv-arch-worker">
        <p className="dv-label">One Cloudflare Worker (Hono)</p>
        <ul className="plain dv-routes">
          <li>
            <code>/</code> public site, server-rendered, no JavaScript
          </li>
          <li>
            <code>/app</code> React admin panel
          </li>
          <li>
            <code>/api</code> JSON API, validated and role-checked
          </li>
          <li>
            <code>/mcp</code> MCP endpoint, the same services as the API
          </li>
        </ul>
        <p className="dv-label">Modules</p>
        <ul className="plain dv-chips">
          <li>Core</li>
          {modules.map((module) => (
            <li key={module.id}>{module.name}</li>
          ))}
        </ul>
      </div>
      <div className="dv-arrow" aria-hidden="true" />
      <div className="dv-arch-col">
        <p className="dv-label">Where data goes</p>
        <ul className="plain dv-stack">
          <li className="dv-node">
            <strong>D1</strong>
            <span>SQLite database, one migration per module</span>
          </li>
          <li className="dv-node">
            <strong>Resend</strong>
            <span>Sign-in links, quotes, invoices, every email logged</span>
          </li>
        </ul>
      </div>
      <figcaption id="dv-arch-caption">One deployment: a Worker, a D1 database and static assets. Modules plug into all four entry points.</figcaption>
    </figure>
  );
}

const WRITE_PATH = [
  { code: "Zod schema", text: "Validates the input; customer-readable messages" },
  { code: "ctx.requireRole", text: "Owner, admin or member, also for API tokens" },
  { code: "service", text: "Writes D1; the server computes totals and numbers" },
  { code: "ctx.audit", text: "Who did what, when, from where" },
  { code: "ctx.emit", text: "Other modules react through events" },
];

/** The path every write takes, from any entry point. */
export function WritePath() {
  return (
    <figure className="dv" aria-labelledby="dv-write-caption">
      <ol className="plain dv-flow">
        {WRITE_PATH.map((step) => (
          <li key={step.code}>
            <code>{step.code}</code>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
      <figcaption id="dv-write-caption">Every write, from the admin panel, the API or an MCP tool, goes through the same service function.</figcaption>
    </figure>
  );
}

const MODULE_TREE: Array<[string, string, number]> = [
  ["src/modules/bookings/", "One folder per module", 0],
  ["shared/schema.ts", "Zod schemas and types, used by browser and Worker", 1],
  ["server/service.ts", "Business logic; takes ctx, validates, checks roles, audits", 1],
  ["server/routes.ts", "Thin Hono routes calling the service", 1],
  ["server/tools.ts", "MCP tools wrapping the same services", 1],
  ["server/index.ts", "Registers routes, tools, metrics, events, site pages", 1],
  ["client/", "Pages, widgets and API hooks built from @/app/ui", 1],
  ["README.md", "What the module does and how to change it", 1],
  ["migrations/0008_bookings.sql", "Its tables: TEXT ids, cents, ISO dates", 0],
  ["tests/bookings.test.ts", "Vitest against a real in-memory D1", 0],
];

/** What `npm run module:new bookings "Bookings"` sets up. */
export function ModuleAnatomy() {
  return (
    <figure className="dv" aria-labelledby="dv-tree-caption">
      <ul className="plain dv-tree">
        {MODULE_TREE.map(([path, note, depth]) => (
          <li key={path} className={depth ? "nested" : undefined}>
            <code>{path}</code>
            <span>{note}</span>
          </li>
        ))}
      </ul>
      <figcaption id="dv-tree-caption">
        A module, as <code>npm run module:new bookings "Bookings"</code> scaffolds it. Switch it off in <code>sistemele.config.ts</code> and its routes, screens and tools go with it.
      </figcaption>
    </figure>
  );
}

/** MCP tools per enabled module: a bar chart that is also the data table. */
export function ToolChart({ modules }: { modules: readonly ServerModule[] }) {
  const rows = [{ id: "core", name: "Core", count: coreTools(modules).length }, ...modules.map((module) => ({ id: module.id, name: module.name, count: module.tools?.length ?? 0 }))];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <figure className="dv" aria-labelledby="dv-tools-caption">
      <p className="dv-chart-title">
        MCP tools per module <span>{total} in total</span>
      </p>
      <table className="dv-bars">
        <thead className="sr-only">
          <tr>
            <th scope="col">Module</th>
            <th scope="col">Tools</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} title={`${row.name}: ${row.count} tools`}>
              <th scope="row">{row.name}</th>
              <td>
                <span className="dv-bar" style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }} aria-hidden="true" />
                <span className="dv-value">{row.count}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption id="dv-tools-caption">Counted from the running code. Each tool wraps a module service, so agents get the same validation, roles and audit as people.</figcaption>
    </figure>
  );
}

const AGENT_LOOP = [
  { title: "Read AGENTS.md", text: "Rules, the map and recipes.", href: "/docs/agents" },
  { title: "Read the module README", text: "src/modules/<id>/README.md for the part you touch.", href: "/docs/modules" },
  { title: "Reuse before writing", text: "docs/extending.md maps needs to existing pieces.", href: "/docs/extending" },
  { title: "Follow a recipe", text: "Module, endpoint, tool, widget, page, email.", href: "/docs/agents#recipes" },
  { title: "Test and check", text: "Tests in tests/, then npm run check and npm run build.", href: "/docs/testing" },
];

/** How a coding agent works in this repository. */
export function AgentLoop() {
  return (
    <figure className="dv" aria-labelledby="dv-loop-caption">
      <ol className="plain dv-steps">
        {AGENT_LOOP.map((step) => (
          <li key={step.title}>
            <a href={step.href}>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </a>
          </li>
        ))}
      </ol>
      <figcaption id="dv-loop-caption">The loop a coding agent follows here, with the skill installed or not.</figcaption>
    </figure>
  );
}

/** The non-negotiables, read from AGENTS.md so this page never drifts from the rules. */
export function nonNegotiables(): Array<{ title: string; html: string }> {
  const source = findDoc("agents")?.source ?? "";
  const section = /## Non-negotiables\n([\s\S]*?)\n## /u.exec(source)?.[1] ?? "";
  const inlineHtml = (markdown: string) => (markdown ? renderDocMarkdown(markdown).html.replace(/^<p>|<\/p>$/gu, "") : "");
  return section
    .split("\n")
    .filter((line) => line.startsWith("- **"))
    .map((line) => {
      const match = /^- \*\*(.+?)\*\*\s*(.*)$/u.exec(line);
      return { title: inlineHtml(match?.[1] ?? line.slice(2)), html: inlineHtml(match?.[2] ?? "") };
    });
}

export function RuleGrid() {
  const rules = nonNegotiables();
  if (!rules.length) return null;
  return (
    <figure className="dv" aria-labelledby="dv-rules-caption">
      <ul className="plain dv-rules">
        {rules.map((rule) => (
          <li key={rule.title}>
            <strong dangerouslySetInnerHTML={{ __html: rule.title }} />
            {rule.html ? <span dangerouslySetInnerHTML={{ __html: rule.html }} /> : null}
          </li>
        ))}
      </ul>
      <figcaption id="dv-rules-caption">
        The non-negotiables from <a href="/docs/agents#non-negotiables">AGENTS.md</a>. Every change, by a person or an agent, keeps them.
      </figcaption>
    </figure>
  );
}

/** The skill's files: SKILL.md plus the references it loads on demand. */
export function SkillFiles() {
  const references = ["module", "mcp", "dashboard", "seo", "deploy"].flatMap((slug) => {
    const doc = findDoc(`skill/${slug}`);
    return doc ? [doc] : [];
  });
  return (
    <figure className="dv" aria-labelledby="dv-skill-caption">
      <div className="dv-install">
        <span className="dv-label">Install</span>
        <code>npx skills add aimantas/sistemele</code>
      </div>
      <ul className="plain dv-tree">
        <li>
          <code>skills/sistemele/SKILL.md</code>
          <span>Loaded when a task matches: orient, rules, task → recipe, done</span>
        </li>
        {references.map((doc) => (
          <li key={doc.slug} className="nested">
            <a href={`/docs/${doc.slug}`}>
              <code>{doc.path.replace("skills/sistemele/", "")}</code>
            </a>
            <span>{doc.summary}</span>
          </li>
        ))}
      </ul>
      <figcaption id="dv-skill-caption">The skill is the portable version of AGENTS.md: it works before the repository exists (to start a project) and points back to AGENTS.md inside one.</figcaption>
    </figure>
  );
}

/** Plain-text versions of the visuals for the Markdown (agent) view of a page. */
export function visualsMarkdown(modules: readonly ServerModule[]): string {
  const tools = [["Core", coreTools(modules).length] as const, ...modules.map((module) => [module.name, module.tools?.length ?? 0] as const)];
  return [
    "## MCP tools per module",
    "",
    "| Module | Tools |",
    "| --- | --- |",
    ...tools.map(([name, count]) => `| ${escapeHtml(name)} | ${count} |`),
    "",
    "## Every write",
    "",
    WRITE_PATH.map((step) => `\`${step.code}\``).join(" → "),
    "",
  ].join("\n");
}

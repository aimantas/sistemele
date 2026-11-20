import { BookOpen, Plug, Sparkles, Terminal, type LucideIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { HomeSection, ServerModule } from "@/modules/types.server";
import { coreTools } from "../mcp/core-tools";

/**
 * The starter home page: shown at "/" until a page with the address "home" is
 * published (Website → Pages). The category-standard product landing for the
 * kit: product shots, a get-started guide, the enabled modules with their real
 * MCP tool counts, what agents get and how to deploy your own copy. Edit the
 * copy here, or replace the page without code by publishing a home page.
 *
 * Screenshots: public/screenshots (light) and public/screenshots/dark.
 * Brand logos: public/logos, from Simple Icons (CC0 1.0); the trademarks belong
 * to their owners and are shown only to say what the kit works with.
 */

export const STARTER_REPO = "https://github.com/aimantas/sistemele";
export const DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${STARTER_REPO}`;

const copy = {
  title: "Don’t ask your agent to reinvent the wheel.",
  lead: "A practical starter kit and admin panel for AI-native projects. Sign-in, CRM, quotes, invoices, stock, a website and MCP, already built, tested and documented.",
  localCommands: ["npx degit aimantas/sistemele my-app", "cd my-app", "npm install", "npm run setup", "npm run dev"],
};

const worksWith: Array<{ label: string; logo: string }> = [
  { label: "Claude Code", logo: "claude" },
  { label: "ChatGPT and Codex", logo: "openai" },
  { label: "Cursor", logo: "cursor" },
  { label: "MCP", logo: "modelcontextprotocol" },
  { label: "Cloudflare Workers", logo: "cloudflare" },
  { label: "GitHub", logo: "github" },
  { label: "Resend", logo: "resend" },
];

interface Shot {
  name: string;
  width: number;
  height: number;
  alt: string;
}

const shots = {
  dashboard: { name: "dashboard", width: 1920, height: 1200, alt: "The admin panel dashboard with KPI cards, pipeline, open tasks and low stock" },
  leads: { name: "leads", width: 1824, height: 1260, alt: "The leads inbox with status tabs, filters and a table of leads" },
  lead: { name: "lead", width: 1336, height: 1200, alt: "A lead with its contact details, notes and timeline" },
  pipeline: { name: "pipeline", width: 2704, height: 854, alt: "The pipeline board with Qualified, Proposal, Negotiation, Won and Lost columns and their totals" },
  invoice: { name: "invoice", width: 1336, height: 1200, alt: "An invoice with seller, buyer, line items, VAT and totals" },
} satisfies Record<string, Shot>;

const agentTools: Array<{ title: string; text: ReactNode; markdown: string; icon: LucideIcon }> = [
  { title: "AGENTS.md and a README per module", text: "Rules, a map of the code and recipes, so an agent extends the kit instead of rebuilding it.", markdown: "Rules, a map of the code and recipes, so an agent extends the kit instead of rebuilding it.", icon: BookOpen },
  { title: "Agent skill", text: <code>npx skills add aimantas/sistemele</code>, markdown: "`npx skills add aimantas/sistemele`", icon: Sparkles },
  { title: "Slash commands", text: <code>/new-module /add-widget /add-mcp-tool /ship-check</code>, markdown: "`/new-module`, `/add-widget`, `/add-mcp-tool`, `/ship-check` in Claude Code", icon: Terminal },
  { title: "MCP endpoint", text: "Every module’s tools, limited by the API token’s role.", markdown: "Every module's tools, limited by the API token's role.", icon: Plug },
];

interface Step {
  title: string;
  body: ReactNode;
  markdown: string;
}

function steps(origin: string, demo: boolean): Step[] {
  return [
    demo
      ? {
          title: "Open the admin panel",
          body: "One click signs you in as the demo owner. Leads, pipeline, quotes, invoices and stock hold sample data that resets every hour.",
          markdown: "One click signs you in as the demo owner. Leads, pipeline, quotes, invoices and stock hold sample data that resets every hour.",
        }
      : {
          title: "Open the admin panel",
          body: (
            <>
              Sign in at <a href="/app/login">/app/login</a> with an address from <code>ADMIN_EMAILS</code>. The sign-in link arrives by email.
            </>
          ),
          markdown: `Sign in at ${origin}/app/login with an address from \`ADMIN_EMAILS\`. The sign-in link arrives by email.`,
        },
    {
      title: "Make it yours",
      body: "Settings → Business and Brand set the name, logo, colour and corners used here, in the admin panel and on invoices.",
      markdown: "Settings → Business and Brand set the name, logo, colour and corners used here, in the admin panel and on invoices.",
    },
    {
      title: "Replace this page",
      body: (
        <>
          In Website → Pages, publish a page with the address <code>home</code>. It takes this page’s place; your newest posts show under it.
        </>
      ),
      markdown: "In Website → Pages, publish a page with the address `home`. It takes this page's place; your newest posts show under it.",
    },
    {
      title: "Hand it to your agent",
      body: (
        <>
          Coding agents start from <code>AGENTS.md</code>. Running agents connect over MCP at <code>{origin}/mcp</code>.
        </>
      ),
      markdown: `Coding agents start from \`AGENTS.md\`. Running agents connect over MCP at \`${origin}/mcp\`.`,
    },
  ];
}

/** Black brand marks are inverted in dark mode (see .lp-logo.mono). */
const MONO_LOGOS = new Set(["github", "cursor", "resend", "modelcontextprotocol"]);

function Logo({ name }: { name: string }) {
  return <img className={MONO_LOGOS.has(name) ? "lp-logo mono" : "lp-logo"} src={`/logos/${name}.svg`} width={18} height={18} alt="" />;
}

function Screenshot({ shot, eager }: { shot: Shot; eager?: boolean }) {
  return (
    <a className="browser" href={`/screenshots/${shot.name}.webp`}>
      <span className="browser-bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <picture>
        <source srcSet={`/screenshots/dark/${shot.name}.webp`} media="(prefers-color-scheme: dark)" />
        <img src={`/screenshots/${shot.name}.webp`} width={shot.width} height={shot.height} alt={shot.alt} loading={eager ? "eager" : "lazy"} decoding="async" {...(eager ? { fetchPriority: "high" as const } : {})} />
      </picture>
    </a>
  );
}

function Checks({ items }: { items: string[] }) {
  return (
    <ul className="lp-checks">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export interface StarterHome {
  title: string;
  description: string;
  body: ReactNode;
  markdown: string;
}

export function starterHome({ businessName, origin, demo, modules, sections }: { businessName: string; origin: string; demo: boolean; modules: readonly ServerModule[]; sections: HomeSection[] }): StarterHome {
  const guide = steps(origin, demo);
  const index = [
    { id: "core", name: "Core", description: "Magic-link sign-in, owner, admin and member roles, an audit log, API tokens and the MCP endpoint.", tools: coreTools(modules).length },
    ...modules.map((module) => ({ id: module.id, name: module.name, description: module.description, tools: module.tools?.length ?? 0 })),
  ];
  const toolCount = index.reduce((sum, row) => sum + row.tools, 0);
  const mcpExample = [
    "POST /mcp",
    "Authorization: Bearer sk_…",
    "",
    "{",
    '  "method": "tools/call",',
    '  "params": {',
    '    "name": "crm_list_leads",',
    '    "arguments": { "due": true }',
    "  }",
    "}",
  ].join("\n");

  const markdown = [
    `# ${copy.title}`,
    "",
    copy.lead,
    "",
    `- [Open the admin panel](${origin}/app/login)`,
    `- [Deploy to Cloudflare](${DEPLOY_URL})`,
    `- [Code on GitHub](${STARTER_REPO})`,
    "",
    `Works with: ${worksWith.map((item) => item.label).join(", ")}.`,
    "",
    "## Get started",
    "",
    ...guide.map((step, i) => `${i + 1}. **${step.title}.** ${step.markdown}`),
    "",
    "## The admin panel your agent does not have to build",
    "",
    "- Leads inbox: website messages arrive as leads, with owners, sources and follow-up dates; convert into a contact and a deal in one step.",
    "- Pipeline with your own stages and win chances; weighted pipeline value.",
    "- Quotes customers accept online become gap-free invoices with VAT and payments.",
    "",
    `## What's inside (${toolCount} MCP tools)`,
    "",
    ...index.map((row) => `- **${row.name}** (${row.tools} MCP tools): ${row.description}`),
    "",
    "## Built for agents",
    "",
    ...agentTools.map((tool) => `- **${tool.title}**: ${tool.markdown}`),
    "",
    ...sections.flatMap((section) => [section.markdown.trim(), ""]),
    "## Deploy your own on Cloudflare",
    "",
    `- One click: ${DEPLOY_URL}`,
    "- Or run it locally (Node 22+):",
    "",
    "```bash",
    ...copy.localCommands,
    "```",
    "",
    `Code and guides: ${STARTER_REPO}`,
  ].join("\n");

  const body = (
    <>
      <section className="lp-hero" aria-labelledby="lp-title">
        <div className="wrap lp-hero-copy">
          <h1 id="lp-title">{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
          <div className="actions">
            <a className="button primary lg" href="/app/login">
              Open the admin panel
            </a>
            <a className="button lg" href={DEPLOY_URL}>
              <Logo name="cloudflare" /> Deploy to Cloudflare
            </a>
          </div>
          <p className="lp-meta">
            MIT licence · One Cloudflare Worker and a D1 database ·{" "}
            <a href={STARTER_REPO}>
              <Logo name="github" /> aimantas/sistemele
            </a>
          </p>
        </div>
        <div className="wrap lp-hero-shot">
          <Screenshot shot={shots.dashboard} eager />
        </div>
      </section>

      <section className="lp-strip" aria-labelledby="lp-works">
        <div className="wrap">
          <h2 id="lp-works">Works with the agents and services you already use</h2>
          <ul className="plain lp-logos">
            {worksWith.map((item) => (
              <li key={item.label}>
                <Logo name={item.logo} /> {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="get-started">
        <div className="wrap">
          <h2 id="get-started">Get started</h2>
          <p className="section-lead">Four steps from this page to a system that is yours.</p>
          <ol className="steps lp-steps">
            {guide.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="see-it">
        <div className="wrap">
          <h2 id="see-it">The admin panel your agent does not have to build</h2>
          <p className="section-lead">Leads, pipeline, quotes, invoices, stock and the website share one database and react to each other through typed events.</p>
          <div className="lp-feature">
            <div>
              <h3>Leads inbox</h3>
              <p className="muted">Every website message lands as a lead. Work it from new to qualified, then convert it.</p>
              <Checks items={["Owners, sources and follow-up dates", "Calls and emails mark a lead contacted", "One step to a contact and a deal"]} />
            </div>
            <Screenshot shot={shots.leads} />
          </div>
          <div className="lp-wide">
            <div className="lp-wide-copy">
              <h3>Pipeline with your own stages</h3>
              <p className="muted">Drag deals between stages you define, each with a win chance; the board shows open and weighted value.</p>
            </div>
            <Screenshot shot={shots.pipeline} />
          </div>
          <div className="lp-pair">
            <figure>
              <Screenshot shot={shots.lead} />
              <figcaption>
                <strong>One timeline per lead.</strong> Calls, emails, meetings and tasks, with owner and follow-up at hand.
              </figcaption>
            </figure>
            <figure>
              <Screenshot shot={shots.invoice} />
              <figcaption>
                <strong>Quotes to invoices.</strong> Accepted online, invoiced with gap-free numbers, VAT per rate and payments.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="inside">
        <div className="wrap">
          <div className="section-head">
            <h2 id="inside">What’s inside</h2>
            <span className="muted lp-count">{toolCount} MCP tools</span>
          </div>
          <p className="section-lead">Each module is a folder with its tables, API, screens, tests and agent tools. Switch one off in sistemele.config.ts and its routes, screens and tools go with it.</p>
          <ul className="plain lp-index">
            {index.map((row) => (
              <li key={row.id}>
                <h3>{row.name}</h3>
                <p>{row.description}</p>
                <span className="lp-tools">{row.tools} tools</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="agents">
        <div className="wrap lp-split">
          <div>
            <h2 id="agents">Built for agents</h2>
            <p className="section-lead">Your coding agent reads the rules before it writes code. Your running agents call the same services the admin panel uses.</p>
            <ul className="plain lp-agent-list">
              {agentTools.map((tool) => (
                <li key={tool.title}>
                  <span className="icon-badge" aria-hidden="true">
                    <tool.icon size={16} strokeWidth={2} />
                  </span>
                  <div>
                    <h3>{tool.title}</h3>
                    <p className="muted">{tool.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="window" aria-label="An MCP tool call">
            <div className="window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>{origin.replace(/^https?:\/\//u, "")}/mcp</span>
            </div>
            <pre className="terminal">
              <code>{mcpExample}</code>
            </pre>
          </div>
        </div>
      </section>

      {sections.map((section) => (
        <Fragment key={section.id}>{section.body}</Fragment>
      ))}

      <section className="section lp-cta" aria-labelledby="deploy">
        <div className="wrap lp-cta-inner">
          <h2 id="deploy">Deploy your own on Cloudflare</h2>
          <p className="section-lead">The button copies the code to your GitHub, creates the D1 database, asks for your email and a Resend key, and deploys. Every push redeploys.</p>
          <div className="actions">
            <a className="button primary lg" href={DEPLOY_URL}>
              Deploy to Cloudflare
            </a>
            <a className="button lg" href={STARTER_REPO}>
              <Logo name="github" /> View on GitHub
            </a>
          </div>
          <div className="window lp-cta-code">
            <div className="window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>Or run it locally · Node 22+</span>
            </div>
            <pre className="terminal">
              <code>{copy.localCommands.map((line) => `$ ${line}`).join("\n")}</code>
            </pre>
          </div>
        </div>
      </section>
    </>
  );

  return {
    title: "Practical starter kit and admin panel for AI-native projects",
    description: `${businessName} runs on Sistemėlė, a practical starter kit and admin panel for AI-native projects: website, admin panel and MCP on one Cloudflare Worker.`,
    body,
    markdown,
  };
}

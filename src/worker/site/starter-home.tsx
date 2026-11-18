import { BookOpen, Bot, Boxes, Cloud, Database, FileText, Mail, Newspaper, Package, Plug, Receipt, Rocket, Scale, ShieldCheck, Sparkles, Terminal, Users, type LucideIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { HomeSection, ServerModule } from "@/modules/types.server";

/**
 * The starter home page: shown at "/" until a page with the address "home" is
 * published (Website → Pages). A general-purpose welcome with product
 * screenshots, a get-started guide, the enabled modules, what agents get and
 * how to deploy your own copy. Edit the copy here, or replace the page without
 * code by publishing your own home page. Screenshots live in public/screenshots.
 */

export const STARTER_REPO = "https://github.com/aimantas/sistemele";
export const DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${STARTER_REPO}`;

const copy = {
  title: "Don’t ask your agent to reinvent the wheel.",
  lead: "This website, its admin panel and its API for AI agents run on Sistemėlė, a practical starter kit for AI-native projects. Follow the guide to make it yours.",
  localCommands: ["npx degit aimantas/sistemele my-app", "cd my-app", "npm install", "npm run setup", "npm run dev"],
};

const platform: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Cloudflare Workers", icon: Cloud },
  { label: "D1 database", icon: Database },
  { label: "MCP for agents", icon: Plug },
  { label: "MIT licence", icon: Scale },
];

/** Real screens from the demo data (public/screenshots). */
const screens = [
  { src: "/screenshots/leads.webp", width: 1920, height: 1200, title: "Leads inbox", text: "Website messages land as leads. Filter by status, owner, source and due follow-ups.", alt: "The leads inbox with status tabs, filters and a table of leads" },
  { src: "/screenshots/lead.webp", width: 1920, height: 1200, title: "Work a lead, convert in one step", text: "Log calls and emails, set the owner and follow-up date, then convert it into a customer and a deal.", alt: "A lead with its details, timeline and status, owner and follow-up controls" },
  { src: "/screenshots/pipeline.webp", width: 2400, height: 1140, title: "Pipeline with your own stages", text: "Drag deals between stages you define, each with a win chance. The board shows open and weighted value.", alt: "The pipeline board with Qualified, Proposal, Negotiation, Won and Lost columns" },
  { src: "/screenshots/invoice.webp", width: 1920, height: 1200, title: "Quotes to invoices", text: "Priced quotes customers accept online become gap-free invoices with VAT, payments and a private link.", alt: "An invoice with line items, VAT, totals and payments" },
];

const moduleIcons: Record<string, LucideIcon> = { crm: Users, catalog: Package, quotes: FileText, invoices: Receipt, content: Newspaper };

const agentTools: Array<{ title: string; text: ReactNode; markdown: string; icon: LucideIcon }> = [
  { title: "AGENTS.md and a README per module", text: "Rules, a map of the code and recipes, so an agent extends the kit instead of rebuilding it.", markdown: "Rules, a map of the code and recipes, so an agent extends the kit instead of rebuilding it.", icon: BookOpen },
  { title: "Agent skill", text: <code>npx skills add aimantas/sistemele</code>, markdown: "`npx skills add aimantas/sistemele`", icon: Sparkles },
  { title: "Slash commands", text: <code>/new-module /add-widget /add-mcp-tool /ship-check</code>, markdown: "`/new-module`, `/add-widget`, `/add-mcp-tool`, `/ship-check` in Claude Code", icon: Terminal },
  { title: "MCP endpoint", text: "Every module’s tools, limited by the API token’s role.", markdown: "Every module's tools, limited by the API token's role.", icon: Plug },
];

const worksWith = ["Claude Code", "Codex", "Cursor", "Any MCP client"];

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
      body: "Settings → Business and Brand set the name, logo and colours used here, in the admin panel and on invoices. Pipeline → Stages sets your sales steps.",
      markdown: "Settings → Business and Brand set the name, logo and colours used here, in the admin panel and on invoices. Pipeline → Stages sets your sales steps.",
    },
    {
      title: "Replace this page",
      body: (
        <>
          In Website → Pages, publish a page with the address <code>home</code>. It takes this page’s place; your newest blog posts show under it.
        </>
      ),
      markdown: "In Website → Pages, publish a page with the address `home`. It takes this page's place; your newest blog posts show under it.",
    },
    {
      title: "Hand it to your agent",
      body: (
        <>
          Coding agents start from <code>AGENTS.md</code> in the code. Running agents connect over MCP at <code>{origin}/mcp</code> with a token from Settings → API &amp; agents.
        </>
      ),
      markdown: `Coding agents start from \`AGENTS.md\` in the code. Running agents connect over MCP at \`${origin}/mcp\` with a token from Settings → API & agents.`,
    },
  ];
}

function Icon({ icon: Glyph }: { icon: LucideIcon }) {
  return (
    <span className="icon-badge" aria-hidden="true">
      <Glyph size={18} strokeWidth={2} />
    </span>
  );
}

function Shot({ src, width, height, alt, eager }: { src: string; width: number; height: number; alt: string; eager?: boolean }) {
  return (
    <a className="browser" href={src}>
      <span className="browser-bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <img src={src} width={width} height={height} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
    </a>
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
  const inside = [
    { id: "core", name: "Sign-in and roles", description: "Magic-link sign-in, owner, admin and member roles, an audit log and API tokens.", icon: ShieldCheck },
    ...modules.map((module) => ({ id: module.id, name: module.name, description: module.description, icon: moduleIcons[module.id] ?? Boxes })),
  ];
  const mcpExample = [
    `POST ${origin}/mcp`,
    "Authorization: Bearer sk_…",
    "",
    '{ "method": "tools/call",',
    '  "params": { "name": "crm_list_leads",',
    '              "arguments": { "due": true } } }',
  ].join("\n");

  const markdown = [
    `# ${copy.title}`,
    "",
    copy.lead,
    "",
    `- [Open the admin panel](${origin}/app/login)`,
    `- [Deploy your own to Cloudflare](${DEPLOY_URL})`,
    "",
    `Runs on: ${platform.map((item) => item.label).join(", ")}.`,
    "",
    "## Get started",
    "",
    ...guide.map((step, index) => `${index + 1}. **${step.title}.** ${step.markdown}`),
    "",
    "## See it",
    "",
    ...screens.map((screen) => `- [${screen.title}](${origin}${screen.src}): ${screen.text}`),
    "",
    "## What’s inside",
    "",
    ...inside.map((item) => `- **${item.name}**: ${item.description}`),
    "",
    "## Built for agents",
    "",
    ...agentTools.map((tool) => `- **${tool.title}**: ${tool.markdown}`),
    "",
    `Works with: ${worksWith.join(", ")}.`,
    "",
    ...sections.flatMap((section) => [section.markdown.trim(), ""]),
    "## Deploy on Cloudflare",
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
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>{copy.title}</h1>
            <p className="lead">{copy.lead}</p>
            <div className="actions">
              <a className="button primary" href="/app/login">
                Open the admin panel
              </a>
              <a className="button" href={DEPLOY_URL}>
                <Rocket size={18} aria-hidden="true" /> Deploy your own
              </a>
            </div>
            <ul className="chips" aria-label="Runs on">
              {platform.map((item) => (
                <li key={item.label} className="chip">
                  <item.icon size={14} aria-hidden="true" /> {item.label}
                </li>
              ))}
            </ul>
          </div>
          <Shot src="/screenshots/dashboard.webp" width={1920} height={1200} alt="The admin panel dashboard with KPI cards, pipeline, open tasks and low stock" eager />
        </div>
      </section>

      <section className="section" aria-labelledby="get-started">
        <div className="wrap">
          <h2 id="get-started">Get started</h2>
          <ol className="steps four">
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
          <h2 id="see-it">See it</h2>
          <ul className="shots plain">
            {screens.map((screen) => (
              <li key={screen.src}>
                <Shot src={screen.src} width={screen.width} height={screen.height} alt={screen.alt} />
                <h3>{screen.title}</h3>
                <p className="muted">{screen.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="inside">
        <div className="wrap">
          <h2 id="inside">What’s inside</h2>
          <ul className="grid plain">
            {inside.map((item) => (
              <li key={item.id} className="card">
                <Icon icon={item.icon} />
                <h3>{item.name}</h3>
                <p className="muted">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="agents">
        <div className="wrap split">
          <div>
            <h2 id="agents">Built for agents</h2>
            <ul className="features plain">
              {agentTools.map((tool) => (
                <li key={tool.title}>
                  <Icon icon={tool.icon} />
                  <div>
                    <h3>{tool.title}</h3>
                    <p className="muted">{tool.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="stack">
            <pre className="terminal" aria-label="An MCP tool call">
              <code>{mcpExample}</code>
            </pre>
            <ul className="chips" aria-label="Works with">
              {worksWith.map((name) => (
                <li key={name} className="chip">
                  <Bot size={14} aria-hidden="true" /> {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {sections.map((section) => (
        <Fragment key={section.id}>{section.body}</Fragment>
      ))}

      <section className="section" aria-labelledby="deploy">
        <div className="wrap">
          <h2 id="deploy">Deploy on Cloudflare</h2>
          <div className="grid two">
            <div className="card">
              <Icon icon={Cloud} />
              <h3>One click</h3>
              <p className="muted">The button copies the code to your GitHub, creates the D1 database, asks for your email and a Resend key, and deploys. Every push redeploys.</p>
              <ul className="chips">
                {[
                  { label: "Workers", icon: Cloud },
                  { label: "D1", icon: Database },
                  { label: "Resend email", icon: Mail },
                ].map((item) => (
                  <li key={item.label} className="chip">
                    <item.icon size={14} aria-hidden="true" /> {item.label}
                  </li>
                ))}
              </ul>
              <p>
                <a className="button primary" href={DEPLOY_URL}>
                  <Rocket size={18} aria-hidden="true" /> Deploy to Cloudflare
                </a>
              </p>
            </div>
            <div className="card">
              <Icon icon={Terminal} />
              <h3>Run it locally</h3>
              <pre className="terminal">
                <code>{copy.localCommands.map((line) => `$ ${line}`).join("\n")}</code>
              </pre>
              <p className="muted small">
                Needs Node 22 or later. Guides: <a href={STARTER_REPO}>github.com/aimantas/sistemele</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  return {
    title: businessName,
    description: `${businessName} runs on Sistemėlė, a practical starter kit and admin panel for AI-native projects: website, admin panel and MCP on one Cloudflare Worker.`,
    body,
    markdown,
  };
}

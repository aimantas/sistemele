import { Fragment, type ReactNode } from "react";
import type { HomeSection, ServerModule } from "@/modules/types.server";

/**
 * The starter home page: shown at "/" until a page with the address "home" is
 * published (Website → Pages). A general-purpose welcome with a get-started
 * guide, the enabled modules and how to run your own copy. Edit the copy here,
 * or replace the page without code by publishing your own home page.
 */

export const STARTER_REPO = "https://github.com/aimantas/sistemele";
export const DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${STARTER_REPO}`;

const copy = {
  title: "Don’t ask your agent to reinvent the wheel.",
  lead: "This website, its admin panel and its API for AI agents run on Sistemėlė, a practical starter kit for AI-native projects. Follow the guide to make it yours.",
  core: { name: "Sign-in and roles", description: "Magic-link sign-in, owner, admin and member roles, an audit log and API tokens." },
  localCommands: ["npx degit aimantas/sistemele my-app", "cd my-app", "npm install", "npm run setup", "npm run dev"],
};

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

export interface StarterHome {
  title: string;
  description: string;
  body: ReactNode;
  markdown: string;
}

export function starterHome({ businessName, origin, demo, modules, sections }: { businessName: string; origin: string; demo: boolean; modules: readonly ServerModule[]; sections: HomeSection[] }): StarterHome {
  const guide = steps(origin, demo);
  const inside = [copy.core, ...modules.map((module) => ({ name: module.name, description: module.description }))];

  const markdown = [
    `# ${copy.title}`,
    "",
    copy.lead,
    "",
    `- [Open the admin panel](${origin}/app/login)`,
    `- [Deploy your own to Cloudflare](${DEPLOY_URL})`,
    "",
    "## Get started",
    "",
    ...guide.map((step, index) => `${index + 1}. **${step.title}.** ${step.markdown}`),
    "",
    "## What’s inside",
    "",
    ...inside.map((item) => `- **${item.name}**: ${item.description}`),
    "",
    ...sections.flatMap((section) => [section.markdown.trim(), ""]),
    "## Run your own",
    "",
    `- Deploy to Cloudflare in one click: ${DEPLOY_URL}`,
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
        <div className="wrap">
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
          <div className="actions">
            <a className="button primary" href="/app/login">
              Open the admin panel
            </a>
            <a className="button" href={DEPLOY_URL}>
              Deploy your own
            </a>
          </div>
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

      <section className="section" aria-labelledby="inside">
        <div className="wrap">
          <h2 id="inside">What’s inside</h2>
          <ul className="grid plain">
            {inside.map((item) => (
              <li key={item.name} className="card">
                <h3>{item.name}</h3>
                <p className="muted">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {sections.map((section) => (
        <Fragment key={section.id}>{section.body}</Fragment>
      ))}

      <section className="section" aria-labelledby="run-your-own">
        <div className="wrap">
          <h2 id="run-your-own">Run your own</h2>
          <div className="grid two">
            <div className="card">
              <h3>Deploy to Cloudflare</h3>
              <p className="muted">One click copies the code to your GitHub, creates the database, asks for your email and a Resend key, and deploys.</p>
              <p>
                <a className="button primary" href={DEPLOY_URL}>
                  Deploy to Cloudflare
                </a>
              </p>
            </div>
            <div className="card">
              <h3>Run it locally</h3>
              <pre className="code">
                <code>{copy.localCommands.join("\n")}</code>
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

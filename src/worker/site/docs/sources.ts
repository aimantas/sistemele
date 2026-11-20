import agentsMd from "../../../../AGENTS.md?raw";
import designMd from "../../../../DESIGN.md?raw";
import skillMd from "../../../../skills/sistemele/SKILL.md?raw";

/**
 * The documentation shown at /docs, bundled from the repository at build
 * time: AGENTS.md, the agent skill and its references, DESIGN.md and every
 * guide in docs/. Add a guide by creating docs/<name>.md and listing it in
 * GUIDES below (it is bundled automatically; the list sets order, group and
 * summary).
 */

export const REPO_URL = "https://github.com/aimantas/sistemele";

const guideFiles = import.meta.glob<string>("/docs/*.md", { query: "?raw", import: "default", eager: true });
const skillReferenceFiles = import.meta.glob<string>("/skills/sistemele/references/*.md", { query: "?raw", import: "default", eager: true });

export type DocGroup = "Start here" | "For agents" | "Build" | "Run";
export const DOC_GROUPS: DocGroup[] = ["Start here", "For agents", "Build", "Run"];

export interface DocEntry {
  /** URL path under /docs ("" is the index). */
  slug: string;
  /** Repository path of the source file. */
  path: string;
  title: string;
  summary: string;
  group: DocGroup;
  source: string;
}

interface Listing {
  slug: string;
  path: string;
  title: string;
  summary: string;
  group: DocGroup;
}

const LISTINGS: Listing[] = [
  { slug: "getting-started", path: "docs/getting-started.md", title: "Getting started", summary: "Install, run locally, sign in, make it yours.", group: "Start here" },
  { slug: "extending", path: "docs/extending.md", title: "Extending", summary: "What to reuse before writing code, and how to add a module safely.", group: "Start here" },
  { slug: "agents", path: "AGENTS.md", title: "AGENTS.md", summary: "The rules and map every coding agent reads first.", group: "For agents" },
  { slug: "skill", path: "skills/sistemele/SKILL.md", title: "Agent skill", summary: "Installable skill: orient, rules, task → recipe, done.", group: "For agents" },
  { slug: "skill/module", path: "skills/sistemele/references/module.md", title: "Skill: building a module", summary: "The module recipe the skill follows.", group: "For agents" },
  { slug: "skill/mcp", path: "skills/sistemele/references/mcp.md", title: "Skill: MCP", summary: "Connecting a running agent and calling tools.", group: "For agents" },
  { slug: "skill/dashboard", path: "skills/sistemele/references/dashboard.md", title: "Skill: dashboard", summary: "Widgets, metrics and templates.", group: "For agents" },
  { slug: "skill/seo", path: "skills/sistemele/references/seo.md", title: "Skill: public pages", summary: "Public pages, SEO and structured data.", group: "For agents" },
  { slug: "skill/deploy", path: "skills/sistemele/references/deploy.md", title: "Skill: deploying", summary: "Remote steps and the approvals they need.", group: "For agents" },
  { slug: "ai-agents", path: "docs/ai-agents.md", title: "AI agents", summary: "MCP, API tokens, roles and agent workflows.", group: "For agents" },
  { slug: "architecture", path: "docs/architecture.md", title: "Architecture", summary: "Request flow, module system, events, security model.", group: "Build" },
  { slug: "modules", path: "docs/modules.md", title: "Modules", summary: "The module contract and how to build one.", group: "Build" },
  { slug: "dashboard", path: "docs/dashboard.md", title: "Dashboard", summary: "Widgets, KPI metrics, templates.", group: "Build" },
  { slug: "design-system", path: "docs/design-system.md", title: "Design system", summary: "shadcn/ui tokens and components, light and dark, brand settings.", group: "Build" },
  { slug: "design-rules", path: "DESIGN.md", title: "Design rules", summary: "Colours, type, layout and the do's and don'ts.", group: "Build" },
  { slug: "email", path: "docs/email.md", title: "Email", summary: "Resend setup, templates and the delivery log.", group: "Build" },
  { slug: "seo", path: "docs/seo.md", title: "SEO and public pages", summary: "Server-rendered pages, structured data, sitemap, llms.txt.", group: "Build" },
  { slug: "deployment", path: "docs/deployment.md", title: "Deployment", summary: "Cloudflare, D1, secrets, domains and previews.", group: "Run" },
  { slug: "security", path: "docs/security.md", title: "Security", summary: "Sign-in, roles, tokens, CSRF and rate limits.", group: "Run" },
  { slug: "testing", path: "docs/testing.md", title: "Testing", summary: "The test harness and conventions.", group: "Run" },
  { slug: "roadmap", path: "docs/roadmap.md", title: "Roadmap", summary: "What is planned next.", group: "Run" },
];

function sourceFor(path: string): string | undefined {
  if (path === "AGENTS.md") return agentsMd;
  if (path === "DESIGN.md") return designMd;
  if (path === "skills/sistemele/SKILL.md") return skillMd;
  return guideFiles[`/${path}`] ?? skillReferenceFiles[`/${path}`];
}

export const DOCS: DocEntry[] = LISTINGS.flatMap((listing) => {
  const source = sourceFor(listing.path);
  return source ? [{ ...listing, source }] : [];
});

const bySlug = new Map(DOCS.map((doc) => [doc.slug, doc]));
const byPath = new Map(DOCS.map((doc) => [doc.path, doc]));

export const findDoc = (slug: string) => bySlug.get(slug);

/** Joins a relative link onto the directory of `from` ("docs/a.md" + "../AGENTS.md" → "AGENTS.md"). */
export function resolveRepoPath(from: string, href: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of href.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/**
 * A link from a doc's Markdown: other docs open at /docs/<slug>, other
 * repository files on GitHub, absolute and anchor links stay as they are.
 */
export function docHref(from: string, href: string): string {
  if (/^(https?:|mailto:|tel:|#|\/)/iu.test(href)) return href;
  const [target, hash = ""] = href.split("#");
  const path = resolveRepoPath(from, target);
  const doc = byPath.get(path);
  if (doc) return `/docs/${doc.slug}${hash ? `#${hash}` : ""}`;
  return `${REPO_URL}/blob/main/${path}${hash ? `#${hash}` : ""}`;
}

/** Images referenced from docs load from GitHub unless they are absolute. */
export function docImage(from: string, src: string): string {
  if (/^(https?:|\/)/iu.test(src)) return src;
  return `${REPO_URL}/raw/main/${resolveRepoPath(from, src)}`;
}

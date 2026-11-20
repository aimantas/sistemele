import type { DevPage } from "@/modules/types.client";
import { REPOSITORY_URL } from "@/shared/project";

export interface PromptContext {
  page: DevPage;
  /** The module the page belongs to; undefined for core pages. */
  moduleId?: string;
  /** The address the person is looking at, e.g. "/app/crm/leads/ld_01…". */
  location: string;
}

/**
 * A complete brief for a coding agent (Claude Code, Codex, Cursor …) working
 * in the repository: where to start, which page and files, the task, and the
 * rules and checks every change in this kit follows.
 */
export function agentPrompt(task: string, context: PromptContext): string {
  const { page, moduleId, location } = context;
  const readme = moduleId ? ` and src/modules/${moduleId}/README.md` : "";
  return [
    `You are working in the Sistemėlė repository (${REPOSITORY_URL}), a starter kit and admin panel on Cloudflare Workers.`,
    `Read AGENTS.md first${readme}. Reuse what exists before writing new code.`,
    "",
    `Page: ${page.title} (${location})`,
    `What it is: ${page.summary}`,
    "Files:",
    ...page.files.map((file) => `- ${file.path}: ${file.note}`),
    ...(page.tools?.length ? [`MCP tools for this page: ${page.tools.join(", ")}`] : []),
    "",
    `Task: ${task.trim()}`,
    "",
    "Keep the non-negotiables in AGENTS.md: money in integer cents, the server decides totals, numbers and permissions, and every write is validated with Zod, role-checked with ctx.requireRole and audited with ctx.audit.",
    "Use the UI kit in src/app/ui and token classes only. Add or update tests in tests/, update the module README and the relevant docs/ page, run npm run check and npm run build, and check the page at desktop and phone widths.",
    "Finish with a short report: what changed, which files, and how you verified it.",
  ].join("\n");
}

/** A prefilled "new issue" link for feedback on a page. */
export function issueUrl(text: string, context: PromptContext): string {
  const title = `${context.page.title}: ${text.trim().split("\n")[0].slice(0, 80)}`;
  const body = [`Page: ${context.page.title} (${context.location})`, "", text.trim(), "", "Files:", ...context.page.files.map((file) => `- \`${file.path}\``)].join("\n");
  return `${REPOSITORY_URL}/issues/new?${new URLSearchParams({ title, body }).toString()}`;
}

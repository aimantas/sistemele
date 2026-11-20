import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "../sistemele.config";
import { coreDevPages } from "@/app/dev/core-pages";
import { buildDevEntries, findDevEntry } from "@/app/dev/match";
import { agentPrompt, issueUrl } from "@/app/dev/prompt";
import type { DevPage } from "@/modules/types.client";
import { serverModules } from "@/modules/server";
import { allTools } from "@/worker/mcp/routes";

// Plain data only: each module's client/dev.ts, never its React pages.
const devFiles = import.meta.glob<Record<string, DevPage[]>>("/src/modules/*/client/dev.ts", { eager: true });
const root = resolve(import.meta.dirname, "..");

const modules = config.modules.map((id) => {
  const exports = devFiles[`/src/modules/${id}/client/dev.ts`] ?? {};
  const dev = Object.values(exports).find(Array.isArray) ?? [];
  // Route paths as written in the module's client/index.tsx.
  const index = readFileSync(resolve(root, `src/modules/${id}/client/index.tsx`), "utf8");
  const routes = [...index.matchAll(/\{ path: "([^"]+)", lazy:/gu)].map((match) => match[1]);
  return { id, dev, routes };
});
const entries = buildDevEntries(coreDevPages, modules);

describe("developer panel notes", () => {
  it("covers every route a module adds", () => {
    for (const module of modules) {
      expect(module.routes.length, module.id).toBeGreaterThan(0);
      const documented = new Set(module.dev.map((page) => page.path));
      for (const route of module.routes) expect(documented.has(route), `${module.id}: ${route}`).toBe(true);
    }
  });

  it("covers the dashboard and every settings page", () => {
    const paths = coreDevPages.map((page) => page.path);
    expect(paths).toEqual(expect.arrayContaining(["", "settings", "settings/brand", "settings/team", "settings/api", "settings/email", "settings/audit", "settings/modules"]));
  });

  it("names files that exist and tools that exist", () => {
    const tools = new Set(allTools(serverModules).map((tool) => tool.name));
    for (const { page } of entries) {
      expect(page.prompts.length, page.title).toBeGreaterThan(0);
      for (const file of page.files) expect(existsSync(resolve(root, file.path)), `${page.title}: ${file.path}`).toBe(true);
      for (const tool of page.tools ?? []) expect(tools.has(tool), `${page.title}: ${tool}`).toBe(true);
    }
  });

  it("finds the notes for the page on screen, static paths first", () => {
    const title = (path: string) => findDevEntry(entries, path).page.title;
    expect(title("/app")).toBe("Dashboard");
    expect(title("/app/quotes/new")).toBe("Quote editor");
    expect(title("/app/quotes/qt_01abc")).toBe("Quote");
    expect(title("/app/crm/leads/ld_01abc")).toBe("Lead");
    expect(title("/app/settings/brand")).toBe("Settings: brand");
    expect(title("/app/nothing-here")).toBe("This page");
  });

  it("turns a task into a full brief and a GitHub issue", () => {
    const entry = findDevEntry(entries, "/app/crm/leads");
    const context = { page: entry.page, moduleId: entry.moduleId, location: "/app/crm/leads" };
    const brief = agentPrompt("Show the phone number in the table.", context);
    expect(brief).toContain("Read AGENTS.md first and src/modules/crm/README.md.");
    expect(brief).toContain("Page: Leads (/app/crm/leads)");
    expect(brief).toContain("- src/modules/crm/client/LeadsPage.tsx: Status tabs, filters, the table");
    expect(brief).toContain("Task: Show the phone number in the table.");
    expect(brief).toContain("npm run check");
    const issue = new URL(issueUrl("Show the phone number in the table.", context));
    expect(issue.pathname).toBe("/aimantas/sistemele/issues/new");
    expect(issue.searchParams.get("title")).toBe("Leads: Show the phone number in the table.");
  });
});

import { matchPath } from "react-router";
import type { DevPage } from "@/modules/types.client";

/** A developer panel entry: a page's notes and the full /app pattern it answers to. */
export interface DevEntry {
  page: DevPage;
  /** The module the page belongs to; undefined for core pages. */
  moduleId?: string;
  pattern: string;
}

const dynamicSegments = (path: string) => path.split("/").filter((part) => part.startsWith(":")).length;

/** Every documented route, static paths before dynamic ones ("quotes/new" before "quotes/:id"). */
export function buildDevEntries(core: DevPage[], modules: ReadonlyArray<{ id: string; dev?: DevPage[] }>): DevEntry[] {
  return [
    ...core.map((page) => ({ page, pattern: page.path ? `/app/${page.path}` : "/app" })),
    ...modules.flatMap((module) => (module.dev ?? []).map((page) => ({ page, moduleId: module.id, pattern: `/app/${page.path}` }))),
  ].sort((a, b) => dynamicSegments(a.page.path) - dynamicSegments(b.page.path));
}

export const FALLBACK_PAGE: DevPage = {
  path: "*",
  title: "This page",
  summary: "No developer notes for this page yet.",
  files: [{ path: "AGENTS.md", note: "Rules, map and recipes" }],
  prompts: ["Add developer panel notes and starter prompts for this page in its module's client/dev.ts (or src/app/dev/core-pages.ts for core pages)."],
};

export function findDevEntry(entries: readonly DevEntry[], pathname: string): DevEntry {
  return entries.find((entry) => matchPath({ path: entry.pattern, end: true }, pathname)) ?? { page: FALLBACK_PAGE, pattern: "*" };
}

import { Hono } from "hono";
import type { ServerModule, SitemapEntry } from "@/modules/types.server";
import { getContext } from "../context";
import { appOrigin, isIndexable, type AppEnv } from "../env";
import { allTools } from "../mcp/routes";
import { siteContent } from "./content";

const xmlEscape = (value: string) => value.replace(/[<>&'"]/gu, (char) => `&#${char.charCodeAt(0)};`);

/** sitemap.xml, robots.txt and llms.txt, generated from enabled modules. */
export function discoveryRoutes(modules: readonly ServerModule[]) {
  const hasCrm = modules.some((module) => module.id === "crm");

  return new Hono<AppEnv>()
    .get("/sitemap.xml", async (c) => {
      const ctx = getContext(c);
      const origin = appOrigin(c.env);
      const core: SitemapEntry[] = [{ path: "/", changefreq: "weekly", priority: 1 }, ...(hasCrm ? [{ path: "/contact", priority: 0.8 } as SitemapEntry] : []), { path: "/privacy", changefreq: "yearly", priority: 0.2 }];
      const contributed = (await Promise.all(modules.map((module) => module.sitemap?.(ctx) ?? Promise.resolve([])))).flat();
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...core, ...contributed]
        .map(
          (entry) =>
            `  <url><loc>${xmlEscape(origin + entry.path)}</loc>${entry.lastmod ? `<lastmod>${xmlEscape(entry.lastmod.slice(0, 10))}</lastmod>` : ""}${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ""}${entry.priority !== undefined ? `<priority>${entry.priority.toFixed(1)}</priority>` : ""}</url>`,
        )
        .join("\n")}\n</urlset>\n`;
      return c.body(body, 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
    })

    .get("/robots.txt", (c) => {
      const origin = appOrigin(c.env);
      // Preview and development deployments are never indexed, unless ALLOW_INDEXING is set (a public demo).
      const body = isIndexable(c.env)
        ? `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nDisallow: /q/\nDisallow: /i/\n\nSitemap: ${origin}/sitemap.xml\n`
        : "User-agent: *\nDisallow: /\n";
      return c.body(body, 200, { "Content-Type": "text/plain; charset=utf-8" });
    })

    .get("/llms.txt", async (c) => {
      const origin = appOrigin(c.env);
      const business = await getContext(c).business();
      const tools = allTools(modules);
      const body = [
        `# ${business.name}`,
        "",
        `> ${siteContent.home.lead}`,
        "",
        "## Pages",
        "",
        `- [Home](${origin}/): who we are and what we offer`,
        ...(hasCrm ? [`- [Contact](${origin}/contact): send a message, which arrives as a lead; JSON API: POST ${origin}/api/public/crm/inquiries`] : []),
        ...(modules.some((m) => m.id === "catalog") ? [`- [Products](${origin}/products): public products with prices and availability`] : []),
        `- [Privacy policy](${origin}/privacy)`,
        "",
        "Every public page also answers `Accept: text/markdown` with a Markdown version.",
        "",
        "## Agent access (MCP)",
        "",
        `Staff can connect an MCP client to ${origin}/mcp with \`Authorization: Bearer <API token>\` (Settings → API tokens). Tools:`,
        "",
        ...tools.map((tool) => `- \`${tool.name}\`: ${tool.description}`),
        "",
      ].join("\n");
      return c.body(body, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
    })

    .get("/health", (c) => c.json({ ok: true, app: c.env.APP_NAME, environment: c.env.APP_ENV }));
}

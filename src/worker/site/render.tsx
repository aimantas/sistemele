import type { Context } from "hono";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { config } from "../../../sistemele.config";
import type { ModuleContext } from "@/modules/types.server";
import { themeCss } from "@/shared/branding";
import { getContext } from "../context";
import { getBranding } from "../lib/settings";
import { logoUrl } from "./brand";
import { appOrigin, isDemo, type AppEnv } from "../env";
import { Layout, type SiteLink } from "./Layout";
import type { PageMeta } from "./seo";

export interface SiteNavigation {
  /** Fixed links first: Home and links modules declare in `siteLinks`. */
  start: SiteLink[];
  /** Links that depend on data, from modules' `siteMenu` (e.g. pages placed in the menu). */
  menus: Array<(ctx: ModuleContext) => Promise<SiteLink[]>>;
  /** Fixed links last, e.g. the call to action. */
  end: SiteLink[];
}

let navigation: SiteNavigation = { start: [{ label: "Home", href: "/" }], menus: [], end: [] };

/** Called once at startup with the links contributed by enabled modules. */
export function setSiteNavigation(next: SiteNavigation): void {
  navigation = next;
}

/** Header links for one page view. A failing menu is logged and left out, never breaking the page. */
async function siteLinks(ctx: ModuleContext): Promise<SiteLink[]> {
  const dynamic = await Promise.all(
    navigation.menus.map((menu) =>
      menu(ctx).catch((error: unknown) => {
        console.error("Site menu failed", error);
        return [];
      }),
    ),
  );
  const links = [...navigation.start, ...dynamic.flat(), ...navigation.end];
  return links.filter((link, index) => links.findIndex((other) => other.href === link.href) === index);
}

/** True when the client prefers Markdown (AI agents) over HTML. */
export function prefersMarkdown(accept: string | undefined): boolean {
  if (!accept) return false;
  const ranges = accept.toLowerCase().split(",").map((part) => {
    const [type, ...params] = part.trim().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return { type: type.trim(), q: q ? Number(q.slice(2)) : 1 };
  });
  const markdown = ranges.find((range) => range.type === "text/markdown")?.q ?? 0;
  const html = ranges.find((range) => range.type === "text/html")?.q ?? 0;
  return markdown > 0 && markdown >= html;
}

/**
 * The visual direction, kept in the rendered HTML so any later edit can be
 * checked against it (see DESIGN.md).
 */
const DIRECTION_CONTRACT = `<!--
THESIS: Sistemėlė looks like the category standard executed at Linear and Resend craft: a calm product landing and a shadcn/ui admin panel; it refuses quirky themes and the dark neon dev-tool cliché.
OWN-WORLD: shadcn/ui tokens on near-neutral cool greys, one brand colour (Settings → Brand, default forest green) for primary actions, links and focus; Inter; hairline borders, soft offset shadows, 10px radius; light and dark follow the system.
STORY: A developer sees what the kit is, opens the admin panel or deploys their own, and learns what their agent gets.
FIRST VIEWPORT: Centred motto, a short balanced lead, Open the admin panel (primary) and Deploy to Cloudflare, a one-line meta row, then the live dashboard screenshot rising into place over a soft card-to-background wash.
FORM: category standard (user choice over the roll), seed 5542942a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export interface RenderPageOptions {
  meta: PageMeta;
  body: ReactNode;
  /** Plain Markdown version of the page for agents (Accept: text/markdown). */
  markdown?: string;
  status?: 200 | 404 | 410;
}

/** Renders a public page inside the site layout. Use from module `site` routes. */
export async function renderPage(c: Context<AppEnv>, options: RenderPageOptions): Promise<Response> {
  const headers: Record<string, string> = {
    Vary: "Accept",
    "Cache-Control": options.meta.noindex ? "private, no-store" : "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
  };
  if (options.meta.noindex) headers["X-Robots-Tag"] = "noindex, nofollow";

  if (options.markdown && prefersMarkdown(c.req.header("accept"))) {
    return c.body(options.markdown, options.status ?? 200, { ...headers, "Content-Type": "text/markdown; charset=utf-8" });
  }

  const ctx = getContext(c);
  const [business, branding, links] = await Promise.all([ctx.business(), getBranding(ctx.db), siteLinks(ctx)]);
  const html = renderToStaticMarkup(
    <Layout
      meta={options.meta}
      origin={appOrigin(c.env)}
      siteName={business.name}
      language={config.site.language}
      business={business}
      themeCss={themeCss(branding)}
      logoUrl={await logoUrl(branding.logoSvg)}
      links={links}
      currentPath={new URL(c.req.url).pathname}
      demo={isDemo(c.env)}
    >
      {options.body}
    </Layout>,
  );
  return c.body(`<!doctype html>${html.replace("<body>", `<body>${DIRECTION_CONTRACT}`)}`, options.status ?? 200, { ...headers, "Content-Type": "text/html; charset=utf-8" });
}

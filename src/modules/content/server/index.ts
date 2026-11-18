import type { ServerModule } from "@/modules/types.server";
import { contentApi } from "./routes";
import { publishingSummary, searchEntries, siteMenu, sitemapEntries } from "./service";
import { contentHome, contentSite } from "./site";
import { contentTools } from "./tools";

/**
 * Content module: website pages and blog posts written in Markdown, drafted by
 * anyone on the team (or an agent) and published by owners and admins.
 * See src/modules/content/README.md.
 */
export const contentModule: ServerModule = {
  id: "content",
  name: "Content",
  description: "Website pages and blog posts: draft, schedule and publish.",
  api: contentApi,
  site: contentSite,
  siteMenu,
  home: contentHome,
  tools: contentTools,

  metrics: [
    {
      key: "content.published_30d",
      label: "Published (30 days)",
      description: "Pages and posts that went live in the last 30 days.",
      format: "number",
      async compute(ctx) {
        const { published30d, drafts, scheduled } = await publishingSummary(ctx);
        return { value: published30d, hint: [`${drafts} draft${drafts === 1 ? "" : "s"}`, ...(scheduled ? [`${scheduled} scheduled`] : [])].join(" · ") };
      },
    },
  ],

  search: (term, ctx) => searchEntries(ctx, term),
  sitemap: (ctx) => sitemapEntries(ctx),
};

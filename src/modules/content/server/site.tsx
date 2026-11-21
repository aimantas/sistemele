import { Hono } from "hono";
import { config } from "../../../../sistemele.config";
import { formatDate } from "@/shared/dates";
import { SLUG_PATTERN } from "@/shared/slug";
import { getContext } from "@/worker/context";
import { appOrigin, isDemoVisitorRecord, type AppEnv } from "@/worker/env";
import { renderPage } from "@/worker/site/render";
import { breadcrumbJsonLd } from "@/worker/site/seo";
import { excerpt, Markdown, markdownText } from "../shared/markdown";
import type { HomeContribution, HomeSection, ModuleContext } from "@/modules/types.server";
import { HOME_SLUG, RESERVED_PAGE_SLUGS, type Entry } from "../shared/schema";
import { getLiveEntry, listLivePosts } from "./service";

/**
 * Public pages for content: /blog, /blog/:slug, /blog/feed.xml and /:slug for
 * pages. Server-rendered, no client JavaScript. Only live entries (published,
 * publish time passed) are shown; anything else is a 404.
 *
 * /:slug is a catch-all, so it hands unknown addresses to the next route
 * (static files, the 404 page) instead of answering them itself.
 */

const POSTS_PER_PAGE = 20;
const FEED_PATH = "/blog/feed.xml";

const absolute = (origin: string, url: string) => (url.startsWith("/") ? `${origin}${url}` : url);
// Characters XML 1.0 does not allow are dropped before escaping.
// eslint-disable-next-line no-control-regex
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "").replace(/[<>&'"]/gu, (char) => `&#${char.charCodeAt(0)};`);

function describe(entry: Entry, fallback: string): string {
  return entry.summary || excerpt(markdownText(entry.body), 155) || fallback;
}

/**
 * The content module's part of the home page: the live "home" page replaces
 * the default headline (title, summary) and adds its text; the three newest
 * live posts follow. Nothing is added while neither exists.
 */
export async function contentHome(ctx: ModuleContext): Promise<HomeContribution> {
  const [livePage, livePosts] = await Promise.all([getLiveEntry(ctx, "page", HOME_SLUG), listLivePosts(ctx, { limit: 12, offset: 0 })]);
  // On the public demo, only the seed content shapes the home page; what visitors publish stays on its own (noindex) pages.
  const page = livePage && !isDemoVisitorRecord(ctx.env, livePage.id) ? livePage : null;
  const posts = { ...livePosts, items: livePosts.items.filter((post) => !isDemoVisitorRecord(ctx.env, post.id)).slice(0, 3) };
  const origin = appOrigin(ctx.env);
  const date = (value: string | null) => formatDate(value, ctx.locale);
  const sections: HomeSection[] = [];

  if (page?.body.trim()) {
    sections.push({
      id: "content.home",
      markdown: page.body,
      body: (
        <section className="section">
          <div className="wrap">
            <div className="prose home-text">
              <Markdown source={page.body} />
            </div>
          </div>
        </section>
      ),
    });
  }

  if (posts.items.length) {
    sections.push({
      id: "content.latest-posts",
      markdown: ["## From the blog", "", ...posts.items.map((post) => `- [${post.title}](${origin}${post.path}) (${date(post.publishedAt)})${post.teaser ? `: ${post.teaser}` : ""}`), "", `[All posts](${origin}/blog)`].join("\n"),
      body: (
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2>From the blog</h2>
              <a href="/blog">All posts</a>
            </div>
            <ul className="post-rows">
              {posts.items.map((post) => (
                <li key={post.id}>
                  <time dateTime={post.publishedAt ?? undefined}>{date(post.publishedAt)}</time>
                  <div>
                    <a href={post.path}>
                      <h3>{post.title}</h3>
                    </a>
                    {post.teaser ? <p>{post.teaser}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ),
    });
  }

  return {
    ...(page ? { hero: { title: page.title, lead: page.summary, description: describe(page, page.title), ...(page.imageUrl ? { image: page.imageUrl } : {}) } } : {}),
    sections,
  };
}

const feedLink = (origin: string, siteName: string) => ({ type: "application/rss+xml", href: `${origin}${FEED_PATH}`, title: `${siteName}: Blog` });

export const contentSite = new Hono<AppEnv>()
  .get(FEED_PATH, async (c) => {
    const ctx = getContext(c);
    const origin = appOrigin(c.env);
    const business = await ctx.business();
    const posts = await listLivePosts(ctx, { limit: 20, offset: 0 });
    const items = posts.items.filter((post) => !isDemoVisitorRecord(c.env, post.id)).map((post) =>
      [
        "    <item>",
        `      <title>${xml(post.title)}</title>`,
        `      <link>${xml(origin + post.path)}</link>`,
        `      <guid isPermaLink="true">${xml(origin + post.path)}</guid>`,
        `      <pubDate>${new Date(post.publishedAt ?? post.updatedAt).toUTCString()}</pubDate>`,
        post.teaser ? `      <description>${xml(post.teaser)}</description>` : null,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "  <channel>",
      `    <title>${xml(`${business.name}: Blog`)}</title>`,
      `    <link>${xml(`${origin}/blog`)}</link>`,
      `    <description>${xml(`Posts from ${business.name}.`)}</description>`,
      `    <language>${xml(config.site.language)}</language>`,
      `    <atom:link href="${xml(origin + FEED_PATH)}" rel="self" type="application/rss+xml" />`,
      ...(posts.items[0]?.publishedAt ? [`    <lastBuildDate>${new Date(posts.items[0].publishedAt).toUTCString()}</lastBuildDate>`] : []),
      ...items,
      "  </channel>",
      "</rss>",
      "",
    ].join("\n");
    return c.body(body, 200, { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" });
  })

  .get("/blog", async (c) => {
    const pageParam = c.req.query("page");
    const page = pageParam === undefined ? 1 : Number(pageParam);
    if (!Number.isInteger(page) || page < 1) return c.notFound();
    if (pageParam !== undefined && page === 1) return c.redirect("/blog", 301);

    const ctx = getContext(c);
    const origin = appOrigin(c.env);
    const business = await ctx.business();
    const posts = await listLivePosts(ctx, { limit: POSTS_PER_PAGE, offset: (page - 1) * POSTS_PER_PAGE });
    if (page > 1 && posts.items.length === 0) return c.notFound();
    const hasOlder = page * POSTS_PER_PAGE < posts.total;
    const path = page === 1 ? "/blog" : `/blog?page=${page}`;
    const title = page === 1 ? "Blog" : `Blog, page ${page}`;
    const date = (value: string | null) => formatDate(value, ctx.locale);

    return renderPage(c, {
      edit: {
        summary: "Posts are content: write, schedule and publish them in the admin panel or with the content_* MCP tools.",
        admin: { label: "Website → Posts", href: "/app/content/posts" },
        files: [
          { path: "src/modules/content/server/site.tsx", note: "Page, post and blog layouts" },
          { path: "src/modules/content/shared/markdown.tsx", note: "The Markdown the editor supports" },
        ],
      },
      meta: {
        title,
        description: `Posts from ${business.name}, newest first.`,
        path,
        // An empty blog is a thin page: keep it out of search results until the first post.
        noindex: posts.total === 0 || posts.items.some((post) => isDemoVisitorRecord(c.env, post.id)),
        alternates: [feedLink(origin, business.name)],
        jsonLd: [breadcrumbJsonLd(origin, [{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])],
      },
      markdown: [
        `# ${title}`,
        "",
        ...(posts.items.length ? posts.items.map((post) => `- [${post.title}](${origin}${post.path}) (${date(post.publishedAt)})${post.teaser ? `: ${post.teaser}` : ""}`) : ["No posts yet."]),
        "",
        `RSS: ${origin}${FEED_PATH}`,
        "",
      ].join("\n"),
      body: (
        <section className="section">
          <div className="wrap narrow">
            <h1>{title}</h1>
            {posts.items.length === 0 ? (
              <div className="notice">
                <p style={{ margin: 0 }}>No posts yet.</p>
              </div>
            ) : (
              <ol className="post-list">
                {posts.items.map((post) => (
                  <li key={post.id}>
                    <article>
                      <p className="small muted">
                        <time dateTime={post.publishedAt ?? undefined}>{date(post.publishedAt)}</time>
                      </p>
                      <h2>
                        <a href={post.path}>{post.title}</a>
                      </h2>
                      {post.teaser ? <p className="muted">{post.teaser}</p> : null}
                    </article>
                  </li>
                ))}
              </ol>
            )}
            {page > 1 || hasOlder ? (
              <nav className="pager" aria-label="Blog pages">
                {page > 1 ? <a href={page === 2 ? "/blog" : `/blog?page=${page - 1}`}>← Newer posts</a> : <span />}
                {hasOlder ? <a href={`/blog?page=${page + 1}`}>Older posts →</a> : null}
              </nav>
            ) : null}
          </div>
        </section>
      ),
    });
  })

  .get("/blog/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!SLUG_PATTERN.test(slug)) return c.notFound();
    const ctx = getContext(c);
    const post = await getLiveEntry(ctx, "post", slug);
    if (!post) return c.notFound();
    const origin = appOrigin(c.env);
    const business = await ctx.business();
    const url = `${origin}${post.path}`;
    const image = post.imageUrl ? absolute(origin, post.imageUrl) : undefined;
    const description = describe(post, `${post.title}. A post from ${business.name}.`);
    const publishedAt = post.publishedAt ?? post.updatedAt;
    const modifiedAt = post.updatedAt > publishedAt ? post.updatedAt : publishedAt;
    const published = formatDate(publishedAt, ctx.locale);

    return renderPage(c, {
      edit: {
        summary: "This post is content: edit it in the admin panel or with the content_update_entry MCP tool. No code, no deploy.",
        admin: { label: "Edit this post", href: `/app/content/${post.id}` },
        files: [
          { path: "src/modules/content/server/site.tsx", note: "Page, post and blog layouts" },
          { path: "src/modules/content/shared/markdown.tsx", note: "The Markdown the editor supports" },
        ],
      },
      meta: {
        title: post.title,
        description,
        path: post.path,
        noindex: isDemoVisitorRecord(c.env, post.id),
        ogType: "article",
        ogImage: image,
        publishedTime: publishedAt,
        modifiedTime: modifiedAt,
        alternates: [feedLink(origin, business.name)],
        jsonLd: [
          breadcrumbJsonLd(origin, [
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: post.path },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description,
            url,
            mainEntityOfPage: url,
            datePublished: publishedAt,
            dateModified: modifiedAt,
            ...(image ? { image } : {}),
            publisher: { "@type": "Organization", name: business.legalName || business.name, url: origin },
          },
        ],
      },
      markdown: `# ${post.title}\n\nPublished ${published}\n\n${post.body.trim()}\n\n[All posts](${origin}/blog)\n`,
      body: (
        <article className="section">
          <div className="wrap narrow">
            <nav aria-label="Breadcrumb" className="small muted">
              <p>
                <a href="/">Home</a> › <a href="/blog">Blog</a>
              </p>
            </nav>
            <h1>{post.title}</h1>
            <p className="small muted">
              <time dateTime={publishedAt}>{published}</time>
            </p>
            {image ? <img className="entry-image" src={image} alt={post.imageAlt} /> : null}
            <div className="prose">
              <Markdown source={post.body} ugc={isDemoVisitorRecord(c.env, post.id)} />
            </div>
            <p>
              <a href="/blog">All posts</a>
            </p>
          </div>
        </article>
      ),
    });
  })

  .get("/:slug", async (c, next) => {
    const slug = c.req.param("slug");
    if (!SLUG_PATTERN.test(slug) || RESERVED_PAGE_SLUGS.includes(slug)) return next();
    const ctx = getContext(c);
    const page = await getLiveEntry(ctx, "page", slug);
    if (!page) return next();
    // The home page lives at "/"; keep one address for it.
    if (slug === HOME_SLUG) return c.redirect("/", 301);
    const origin = appOrigin(c.env);
    const business = await ctx.business();
    const image = page.imageUrl ? absolute(origin, page.imageUrl) : undefined;

    return renderPage(c, {
      edit: {
        summary: "This page is content: edit it in the admin panel or with the content_update_entry MCP tool. No code, no deploy.",
        admin: { label: "Edit this page", href: `/app/content/${page.id}` },
        files: [
          { path: "src/modules/content/server/site.tsx", note: "Page, post and blog layouts" },
          { path: "src/modules/content/shared/markdown.tsx", note: "The Markdown the editor supports" },
        ],
      },
      meta: {
        title: page.title,
        description: describe(page, `${page.title}. ${business.name}.`),
        path: page.path,
        noindex: isDemoVisitorRecord(c.env, page.id),
        ogImage: image,
        jsonLd: [
          breadcrumbJsonLd(origin, [
            { name: "Home", path: "/" },
            { name: page.title, path: page.path },
          ]),
        ],
      },
      markdown: `# ${page.title}\n\n${page.body.trim()}\n`,
      body: (
        <section className="section">
          <div className="wrap narrow">
            <h1>{page.title}</h1>
            {image ? <img className="entry-image" src={image} alt={page.imageAlt} /> : null}
            <div className="prose">
              <Markdown source={page.body} ugc={isDemoVisitorRecord(c.env, page.id)} />
            </div>
          </div>
        </section>
      ),
    });
  });

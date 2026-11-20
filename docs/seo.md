# SEO and public pages

Public pages are React components rendered to HTML on the Worker
(`renderPage` in `src/worker/site/render.tsx`). They ship no JavaScript, inline
their CSS, and are cached at the edge for 5 minutes with
stale-while-revalidate.

## "Edit this page"

Pass `edit` to `renderPage` to say where a page comes from: a one-line
`summary`, the admin screen that edits it (`admin`) and the repository files
behind it (`files`). On the public demo (`DEMO_MODE=1`) and in local
development the page ends with an "Edit this page" card linking to them on
GitHub; a live site never shows it. Every core and module page sets one.

## What every page gets

- `<title>` = page title + business name; unique meta description.
- `<link rel="canonical">` built from `APP_URL` + the page path (never from the request host, so preview URLs never compete).
- `robots` meta (`index, follow` or `noindex, nofollow`) and `X-Robots-Tag` for private pages.
- Open Graph and Twitter tags; `og:image` when you pass one.
- JSON-LD from `meta.jsonLd` (Organization + WebSite on the home page, BreadcrumbList on inner pages, Product on product pages with a price).
- A Markdown version for `Accept: text/markdown` (agents, LLM crawlers) and a `<link rel="alternate" type="text/markdown">`.
- Semantic layout: skip link, header nav with `aria-current`, one `h1`, footer with the business identity.

## Site-wide files

| URL | Source |
| --- | --- |
| `/sitemap.xml` | Core pages + every module's `sitemap()` (e.g. public products, live pages and posts with `lastmod`). |
| `/blog/feed.xml` | RSS for the latest 20 posts (content module). |
| `/robots.txt` | Production, or any environment with `ALLOW_INDEXING=1` (e.g. a public demo): allow all, disallow `/app`, `/api/`, `/q/`, `/i/`, link to sitemap. Otherwise: disallow all, and every response carries `X-Robots-Tag: noindex, nofollow`. |
| `/llms.txt` | Business summary, public pages, how to send a request, MCP tool list. |

## Rules for new pages

1. One clear purpose and one `h1`.
2. Title under ~60 characters, description 120–160, both unique and written for the searcher.
3. Structured data only for facts visible on the page. Product `Offer` only with a real price; `availability` only when stock is tracked. No ratings or reviews unless they are real and shown.
4. Private or transactional pages (`/q/:token`, `/i/:token`, anything per customer): `noindex: true`.
5. Add indexable pages to the module's `sitemap()`.
6. Link the page from somewhere useful (header via `siteLinks`, home page, related pages).
7. Images: explicit width/height, meaningful `alt`, modern formats, lazy below the fold.
8. Retiring a page: return a 301 to its replacement from a `site` route rather than leaving a 404 that used to rank.

## Editing the content

- Pages and blog posts: dashboard → Website (content module). Each live page has its own title, description (the summary), canonical URL and breadcrumb; posts add `BlogPosting` JSON-LD and article dates. See `src/modules/content/README.md`.
- Home page: the content module's page with the address `home` replaces the default headline and adds its text; modules add sections through `home()` (latest posts). The default copy, contact and privacy text live in `src/worker/site/content.ts`.
- Business identity (name, address, contacts): Settings → Business.
- Styles: `src/worker/site/styles.css` (tokens at the top).
- Header links: `siteLinks` (fixed) and `siteMenu` (from data, e.g. pages with a menu position) in module server definitions; the contact link appears when CRM is on.
- `PageMeta` also takes `publishedTime`/`modifiedTime` (article dates) and `alternates` (e.g. an RSS feed link).

## Checks

```bash
curl -s https://your-domain/ | grep -E '<title>|canonical|ld\+json'
curl -s -H 'Accept: text/markdown' https://your-domain/
curl -s https://your-domain/sitemap.xml
```

Run Lighthouse (mobile) on the home page and one module page; aim for 95+ on
Performance, Accessibility, Best Practices and SEO. In Claude Code, `/seo-check`
walks through this list.

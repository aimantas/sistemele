# Public pages and SEO

Public pages are `site` Hono routes returning `renderPage(c, { meta, body, markdown })`
(`src/worker/site/render.tsx`). Server-rendered React, inline CSS, no client JS.

```ts
.get("/services/:slug", async (c) => {
  const item = await getPublicService(getContext(c), c.req.param("slug"));
  if (!item) return c.notFound();
  return renderPage(c, {
    meta: {
      title: item.name,                                  // < 60 chars, unique
      description: item.summary,                         // 120–160 chars, unique
      path: `/services/${item.slug}`,                    // canonical path
      jsonLd: [breadcrumbJsonLd(origin, [{ name: "Home", path: "/" }, { name: item.name, path: `/services/${item.slug}` }])],
    },
    markdown: `# ${item.name}\n\n${item.summary}\n`,
    body: <section className="section"><div className="wrap"><h1>{item.name}</h1>…</div></section>,
  });
})
```

Rules: one `h1`; JSON-LD only for visible facts (Product `Offer` only with a
real price; no fake ratings); `noindex: true` for private/per-customer pages;
add indexable pages to the module's `sitemap()`; header links through
`siteLinks`; images with width/height and alt. Copy lives in
`src/worker/site/content.ts`; business identity in Settings.

Check: `curl -s <url> | grep -E '<title>|canonical|ld\+json'`,
`curl -H 'Accept: text/markdown' <url>`, `/sitemap.xml`, Lighthouse mobile ≥ 95.

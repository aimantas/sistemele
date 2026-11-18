---
description: Audit the public site against docs/seo.md
---

Audit the public pages of this Sistemėlė project.

1. Read docs/seo.md and every `site` route (`src/worker/site/pages.tsx`, module `server/routes.ts` files).
2. With the dev server running, fetch each public URL (home, contact, privacy, products, one product) and check: one h1, unique title (<60) and description (120–160), canonical uses APP_URL, robots meta, JSON-LD validity and truthfulness, Markdown response for `Accept: text/markdown`, presence in /sitemap.xml, internal links, image alt/dimensions.
3. Check /robots.txt and /llms.txt.
4. Report findings as a prioritised list with file:line fixes. Fix only what the user approves.

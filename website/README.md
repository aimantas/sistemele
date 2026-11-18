# Sistemėlė website

The public landing page for Sistemėlė, in English (`/`) and Lithuanian (`/lt/`).
It is plain HTML, CSS and a small script with no build step, deployed as a
static-assets-only Cloudflare Worker. It sets no cookies and makes no
third-party requests.

## Files

| Path | What it is |
| --- | --- |
| `public/index.html` | English page |
| `public/lt/index.html` | Lithuanian page (same sections and ids as the English one) |
| `public/styles.css` | All styles; design tokens at the top |
| `public/main.js` | Progressive enhancement only: the module run highlight, copy buttons, closing the phone menu |
| `public/404.html` | Served for any missing path |
| `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt` | Crawlers and agents |
| `public/og.png`, `public/og-lt.png` | 1200 × 630 share images |
| `public/_headers` | Security headers (strict same-origin CSP) |
| `public/favicon.svg` | The app's mark |
| `wrangler.jsonc` | Worker `sistemele-website`, assets from `./public`, `not_found_handling: "404-page"` |
| `site.config.json`, `scripts/configure.mjs` | The placeholders and the script that changes them |

## Preview

From this folder:

```bash
npx wrangler dev -c wrangler.jsonc
```

Open http://localhost:8787 and http://localhost:8787/lt/. Any other path
shows the 404 page with a 404 status. `npx` uses the Wrangler installed at the
repository root (`npm install` there first) and downloads it otherwise.

Always pass `-c wrangler.jsonc`. After the app at the repository root has been
built, Wrangler also finds `../.wrangler/deploy/config.json` and refuses to
guess which configuration you mean.

## Deploy

```bash
npx wrangler login                  # once, with the Cloudflare account that will own the site
npx wrangler deploy -c wrangler.jsonc
```

The site goes live on the account's `workers.dev` subdomain. To use your own
domain, add the zone to Cloudflare, then uncomment `routes` in `wrangler.jsonc`
(or add a custom domain in the dashboard) and deploy again.

## Placeholders

Three values are placeholders. They live in `site.config.json`, which always
matches what the files contain.

| Value | Current | Status | Appears in |
| --- | --- | --- | --- |
| Site origin | `https://sistemele.dev` | Unconfirmed: the domain is not verified as registered or pointed at this Worker | canonical, `hreflang`, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt` |
| GitHub owner | `aimantas` | Confirmed GitHub organisation, 2026-11-18 | repository links, `npx degit`, `npx skills add`, JSON-LD |
| Contact email | `hello@sistemele.dev` | Placeholder: the mailbox is not verified | "Have it set up" section, footer, JSON-LD, `llms.txt` |

Change any of them everywhere at once:

```bash
node scripts/configure.mjs --origin https://example.com --owner your-github-user --email hello@example.com
node scripts/configure.mjs --owner your-github-user --dry-run   # show what would change
```

## Editing

- Keep the two languages in step: the same sections, ids and links. Lithuanian copy uses lowercase "jūs".
- Colours, type and radii follow the repository's `DESIGN.md` (paper, ink, brand green `#1f5f4a`, system font stack). Change them in the `:root` block of `styles.css`; no colour or font is written anywhere else.
- The dashboard, the four sale records and the template boards are built in HTML with sample data (Example Kitchen, round amounts). Each sits in a `data-slot` container. To show a real screenshot instead, put an `<img src="/shots/dashboard.png" width="…" height="…" alt="…">` as the first child of the slot; the CSS hides the built sample. Then drop the `role="img"` and `aria-label` from that figure.
- The FAQ uses `<details>`, the template switcher uses radio inputs, and the phone menu uses `<details>`, so every part works without JavaScript.
- The CSP in `_headers` allows same-origin scripts and styles only. Keep scripts in `main.js` and styles in `styles.css`, or update the policy.
- If the hero changes, re-capture `og.png` and `og-lt.png` at 1200 × 630.

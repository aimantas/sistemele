import type { ReactNode } from "react";
import type { BusinessProfile } from "@/shared/business";
import { SiteBrandContext } from "./brand-context";
import { jsonLdScript, type PageMeta } from "./seo";
import styles from "./styles.css?raw";

export interface SiteLink {
  label: string;
  href: string;
}

export interface LayoutProps {
  meta: PageMeta;
  origin: string;
  siteName: string;
  language: string;
  business: BusinessProfile;
  /** Brand variables from Settings → Brand, applied after the base styles. */
  themeCss: string;
  logoUrl: string | null;
  links: SiteLink[];
  currentPath: string;
  /** Public demo: a bar above the header says the data is sample data. */
  demo?: boolean;
  children: ReactNode;
}

/** Full HTML document for public pages. Server-rendered, no client JavaScript. */
export function Layout({ meta, origin, siteName, language, business, themeCss, logoUrl, links, currentPath, demo, children }: LayoutProps) {
  const canonical = `${origin}${meta.path}`;
  const fullTitle = meta.title === siteName ? siteName : `${meta.title} | ${siteName}`;
  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content={meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"} />
        <meta property="og:type" content={meta.ogType ?? "website"} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={canonical} />
        {meta.ogImage ? <meta property="og:image" content={meta.ogImage} /> : null}
        {meta.publishedTime ? <meta property="article:published_time" content={meta.publishedTime} /> : null}
        {meta.modifiedTime ? <meta property="article:modified_time" content={meta.modifiedTime} /> : null}
        <meta name="twitter:card" content={meta.ogImage ? "summary_large_image" : "summary"} />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate" type="text/markdown" href={canonical} />
        {(meta.alternates ?? []).map((alternate) => (
          <link key={alternate.href} rel="alternate" type={alternate.type} href={alternate.href} title={alternate.title} />
        ))}
        <style dangerouslySetInnerHTML={{ __html: styles + themeCss }} />
        {(meta.jsonLd ?? []).map((item, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(item) }} />
        ))}
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {demo ? (
          <p className="demo-bar">
            Demo site with sample data. <a href="/app/login">Open the dashboard</a>
          </p>
        ) : null}
        <header className="site-header">
          <div className="wrap header-row">
            <a className="brand" href="/">
              {logoUrl ? <img src={logoUrl} alt={business.name} height={32} className="brand-logo" /> : business.name}
            </a>
            <nav aria-label="Main">
              <ul>
                {links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} aria-current={currentPath === link.href ? "page" : undefined}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main id="main">
          <SiteBrandContext.Provider value={{ name: business.name, logoUrl }}>{children}</SiteBrandContext.Provider>
        </main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div>
              <strong>{business.legalName || business.name}</strong>
              {business.companyCode ? <p>Company code {business.companyCode}</p> : null}
              {business.vatCode ? <p>VAT {business.vatCode}</p> : null}
            </div>
            <div>
              {business.address ? <p>{business.address}</p> : null}
              {business.email ? (
                <p>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </p>
              ) : null}
              {business.phone ? (
                <p>
                  <a href={`tel:${business.phone.replace(/\s/gu, "")}`}>{business.phone}</a>
                </p>
              ) : null}
            </div>
            <div>
              <p>
                <a href="/privacy">Privacy policy</a>
              </p>
              <p className="muted">Runs on Sistemėlė</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

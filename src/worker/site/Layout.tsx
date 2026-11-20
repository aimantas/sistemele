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

/** The open-source project, linked from the footer ("Runs on Sistemėlė") and the demo bar. */
const SISTEMELE_REPO = "https://github.com/aimantas/sistemele";
/** The author's credit, shown on the public demo only; your own site keeps its footer to itself. */
const AUTHOR_URL = "https://aimantas.com";

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
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <meta name="theme-color" content="#f8f9fb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f1013" media="(prefers-color-scheme: dark)" />
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
            Demo site with sample data. <a href="/app/login">Open the dashboard</a> · <a href={SISTEMELE_REPO}>Get the code on GitHub</a>
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
          <div className="wrap footer-main">
            <div className="footer-brand">
              {logoUrl ? <img src={logoUrl} alt="" height={24} className="brand-logo" /> : null}
              <address>
                <strong>{business.legalName || business.name}</strong>
                {business.companyCode ? <span>Company code {business.companyCode}</span> : null}
                {business.vatCode ? <span>VAT {business.vatCode}</span> : null}
                {business.address ? <span>{business.address}</span> : null}
                {business.email ? <a href={`mailto:${business.email}`}>{business.email}</a> : null}
                {business.phone ? <a href={`tel:${business.phone.replace(/\s/gu, "")}`}>{business.phone}</a> : null}
              </address>
            </div>
            <nav aria-label="Footer">
              <ul className="footer-links">
                {links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
                <li>
                  <a href="/privacy">Privacy policy</a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="wrap footer-bar">
            <p>
              Runs on <a href={SISTEMELE_REPO}>Sistemėlė</a>
            </p>
            {demo ? (
              <p>
                <a href="/app/design">Design system</a> · Made by <a href={AUTHOR_URL}>aimantas.com</a>
              </p>
            ) : null}
          </div>
        </footer>
      </body>
    </html>
  );
}

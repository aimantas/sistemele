import type { BusinessProfile } from "@/shared/business";

export interface PageMeta {
  /** Unique per page, under ~60 characters. The site name is appended. */
  title: string;
  /** Unique per page, 120–160 characters, written for the searcher. */
  description: string;
  /** Path of the canonical URL, e.g. "/products/steel-cage". */
  path: string;
  /** Private or transactional pages (quote links, invoices): noindex, nofollow. */
  noindex?: boolean;
  ogType?: "website" | "article" | "product";
  ogImage?: string;
  /** Posts: when it was first published and last changed (ISO), as article:published_time / modified_time. */
  publishedTime?: string;
  modifiedTime?: string;
  /** Extra <link rel="alternate"> tags, e.g. the blog's RSS feed. */
  alternates?: Array<{ type: string; href: string; title: string }>;
  /** Schema.org objects. Only describe facts that are visible on the page. */
  jsonLd?: Array<Record<string, unknown>>;
}

export function organizationJsonLd(business: BusinessProfile, origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: business.legalName || business.name,
    url: origin,
    ...(business.email ? { email: business.email } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.address ? { address: business.address } : {}),
    ...(business.vatCode ? { vatID: business.vatCode } : {}),
  };
}

export function breadcrumbJsonLd(origin: string, items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${origin}${item.path}` })),
  };
}

/** Serialises JSON-LD safely inside a <script> tag. */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c");
}

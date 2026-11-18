/**
 * Project configuration. This is the first file an agent or developer edits
 * when adapting Sistemėlė to a business.
 *
 * - `modules`: enabled modules, in navigation order. Remove an id to switch a
 *   module off (its tables stay; routes, navigation, widgets and MCP tools go).
 * - `business`: defaults shown until the owner saves Settings → Business.
 * - `site`: public website metadata used for SEO, sitemap and structured data.
 */
export const config = {
  modules: ["crm", "catalog", "quotes", "invoices", "content"] as const,
  locale: "en-GB",
  currency: "EUR",
  timezone: "Europe/Vilnius",
  business: {
    name: "Sistemėlė Demo",
    defaultVatRateBps: 2100,
    invoicePrefix: "INV",
    quotePrefix: "Q",
    paymentTermsDays: 14,
  },
  site: {
    title: "Sistemėlė Demo",
    description: "A small business running its customers, products, quotes and invoices on one fast system.",
    /** Public pages listed in sitemap.xml. Modules may add more. */
    language: "en",
  },
} as const;

export type ModuleId = (typeof config.modules)[number] | "core";

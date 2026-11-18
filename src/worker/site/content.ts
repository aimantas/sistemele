/**
 * Default public website copy. Edit it to adapt the site to a business, or
 * publish a page with the address "home" in Website → Pages, which replaces
 * the home headline and adds its text without a code change.
 * Business name, address and contacts come from Settings → Business.
 * Keep claims specific and true: no invented reviews, prices, reply times or guarantees.
 */
export const siteContent = {
  home: {
    /** Empty: the business name from Settings → Business is the headline. */
    headline: "",
    lead: "Products, services and news from our team. Send a message and we reply by email.",
    contactCta: { label: "Get in touch", href: "/contact" },
  },
  contact: {
    title: "Contact us",
    description: "Send a message with what you need. We reply by email.",
    lead: "Tell us what you need. Quantities, sizes and dates help us answer the first time.",
    success: "Thank you. Your message is in. We reply by email.",
  },
  privacy: {
    title: "Privacy policy",
    description: "What data we collect through this website, why, and how long we keep it.",
  },
} as const;

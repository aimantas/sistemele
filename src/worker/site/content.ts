/**
 * Public website copy. Edit this file to adapt the site to a business.
 * Keep claims specific and true; no invented reviews, prices or guarantees.
 * Business name, address and contacts come from Settings → Business.
 */
export const siteContent = {
  home: {
    title: "Products, quotes and invoices from one small team",
    description: "Ask for a quote, get a clear price with VAT, and receive the invoice by email. Replace this text in src/worker/site/content.ts.",
    eyebrow: "Small business, clear process",
    headline: "Tell us what you need. We reply with a priced quote.",
    lead: "Send a short request with quantities or a description. You get a quote you can open, check and accept online.",
    primaryCta: { label: "Request a quote", href: "/contact" },
    secondaryCta: { label: "See products", href: "/products" },
    steps: [
      { title: "Send a request", text: "Describe the product or service, the quantity and when you need it." },
      { title: "Get a priced quote", text: "We send a quote with every line, the VAT and the total. Open it from the email." },
      { title: "Accept and receive the invoice", text: "Accept the quote online. The invoice arrives by email with the payment details." },
    ],
  },
  contact: {
    title: "Request a quote",
    description: "Send your request with quantities and dates. We reply with a priced quote by email.",
    lead: "Describe what you need. Quantities, sizes and dates help us price it the first time.",
    success: "Thank you. Your request is in. We reply by email, usually within one working day.",
  },
  privacy: {
    title: "Privacy policy",
    description: "What data we collect through this website, why, and how long we keep it.",
  },
} as const;

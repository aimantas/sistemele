import type { DevPage } from "@/modules/types.client";

const editor: Omit<DevPage, "path"> = {
  title: "Quote editor",
  summary: "Create or edit a draft quote: customer, line items from the catalog, discounts and VAT; totals are previews, the server decides.",
  files: [
    { path: "src/modules/quotes/client/QuoteEditorPage.tsx", note: "The editor" },
    { path: "src/app/components/LineItemsEditor.tsx", note: "Shared line items editor" },
    { path: "src/shared/lines.ts", note: "Line and total maths (cents, bps)" },
    { path: "src/modules/quotes/server/service.ts", note: "Server-side totals and saving" },
  ],
  tools: ["quotes_create", "quotes_update_draft"],
  prompts: [
    "Add optional line items that the customer can tick on and off when they accept the quote online.",
    "Let a quote be duplicated into a new draft from the editor.",
  ],
};

/** Developer panel notes and agent prompts for the quotes pages (dev mode). */
export const quotesDev: DevPage[] = [
  {
    path: "quotes",
    title: "Quotes",
    summary: "Priced offers: drafts, sent, accepted and declined, with what is awaiting an answer.",
    files: [
      { path: "src/modules/quotes/client/QuotesPage.tsx", note: "List and filters" },
      { path: "src/modules/quotes/server/service.ts", note: "Quote services and numbering" },
      { path: "migrations/0004_quotes.sql", note: "Quotes and quote lines" },
      { path: "tests/quotes.test.ts", note: "Quote tests" },
    ],
    tools: ["quotes_list", "quotes_get"],
    prompts: [
      "Add quote expiry: a valid-until date, an Expired status computed on the server and a reminder email three days before.",
      "Show the acceptance rate for the last 90 days above the quotes list.",
    ],
  },
  { path: "quotes/new", ...editor },
  { path: "quotes/:id/edit", ...editor },
  {
    path: "quotes/:id",
    title: "Quote",
    summary: "One quote: the document, send by email, the customer link, acceptance and turning it into an invoice.",
    files: [
      { path: "src/modules/quotes/client/QuoteDetailPage.tsx", note: "Quote page and actions" },
      { path: "src/modules/quotes/client/QuoteDocument.tsx", note: "The quote document" },
      { path: "src/modules/quotes/server/site.tsx", note: "Customer link /q/… and online acceptance" },
    ],
    tools: ["quotes_send", "quotes_mark", "invoices_create_from_quote"],
    prompts: [
      "Add a PDF download of the quote rendered on the Worker, matching the on-screen document.",
      "Let the customer ask a question from the quote link; it arrives as an activity on the contact.",
    ],
  },
];

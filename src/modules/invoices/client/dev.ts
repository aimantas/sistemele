import type { DevPage } from "@/modules/types.client";

const editor: Omit<DevPage, "path"> = {
  title: "Invoice editor",
  summary: "Create or edit a draft invoice; issuing it assigns a gap-free number and makes it immutable.",
  files: [
    { path: "src/modules/invoices/client/InvoiceEditorPage.tsx", note: "The editor" },
    { path: "src/app/components/LineItemsEditor.tsx", note: "Shared line items editor" },
    { path: "src/shared/money.ts", note: "Money in cents, VAT in basis points" },
    { path: "src/modules/invoices/server/service.ts", note: "Totals, issue and numbering" },
  ],
  tools: ["invoices_create_draft", "invoices_issue"],
  prompts: [
    "Add reverse-charge VAT for EU business customers with a VAT code: 0% lines and the legal note on the invoice.",
    "Prefill a new invoice's payment terms from the customer's last invoice.",
  ],
};

/** Developer panel notes and agent prompts for the invoices pages (dev mode). */
export const invoicesDev: DevPage[] = [
  {
    path: "invoices",
    title: "Invoices",
    summary: "Drafts, issued, paid, overdue and void invoices, with what is outstanding.",
    files: [
      { path: "src/modules/invoices/client/InvoicesPage.tsx", note: "List and filters" },
      { path: "src/modules/invoices/server/service.ts", note: "Invoice services" },
      { path: "migrations/0005_invoices.sql", note: "Invoices, lines and payments" },
      { path: "tests/invoices.test.ts", note: "Invoice tests" },
    ],
    tools: ["invoices_list", "invoices_get"],
    prompts: [
      "Send an automatic reminder email when an invoice is 7 days overdue, once, logged in the email log.",
      "Add an export of issued invoices for a month as CSV for the accountant, owners and admins only.",
    ],
  },
  { path: "invoices/new", ...editor },
  { path: "invoices/:id/edit", ...editor },
  {
    path: "invoices/:id",
    title: "Invoice",
    summary: "One invoice: the document, sending, payments, void and the customer link.",
    files: [
      { path: "src/modules/invoices/client/InvoiceDetailPage.tsx", note: "Invoice page, payments, void" },
      { path: "src/modules/invoices/server/service.ts", note: "Issue, send, record payment, void" },
      { path: "src/modules/invoices/server/site.tsx", note: "Customer link /i/…" },
    ],
    tools: ["invoices_send", "invoices_record_payment"],
    prompts: [
      "Add a payment QR code (EPC/SEPA) to the invoice document with the IBAN, amount due and invoice number.",
      "Add partial refunds as negative payments with a reason, shown in the payments list.",
    ],
  },
];

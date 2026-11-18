import { Hono } from "hono";
import { config } from "../../../../sistemele.config";
import { formatDate } from "@/shared/dates";
import { documentTotals, formatMoney } from "@/shared/money";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { DocumentView } from "@/worker/site/DocumentView";
import { renderNotFound } from "@/worker/site/pages";
import { renderPage } from "@/worker/site/render";
import { getPublicInvoice, type PublicInvoice } from "./service";

const badge = (label: string, tone: "paid" | "void") => (
  <span className="badge" style={tone === "void" ? { background: "#fdf1ef", color: "var(--danger)" } : undefined}>
    {label}
  </span>
);

function markdown({ invoice, lines, seller, buyer }: PublicInvoice, locale: string): string {
  const money = (cents: number) => formatMoney(cents, invoice.currency, locale);
  return [
    `# Invoice ${invoice.number}`,
    "",
    `Status: ${invoice.status}${invoice.overdue ? " (overdue)" : ""}`,
    `From: ${seller.name}`,
    `To: ${buyer.name}`,
    `Issue date: ${invoice.issueDate ?? "—"}`,
    `Due date: ${invoice.dueDate ?? "—"}`,
    "",
    "| Description | Qty | Unit price | VAT | Net |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...lines.map((line) => `| ${line.description.replace(/\|/gu, "\\|")} | ${line.quantity} ${line.unit} | ${money(line.unitPriceCents)} | ${line.vatRateBps / 100}% | ${money(line.subtotalCents)} |`),
    "",
    `Total: ${money(invoice.totalCents)}`,
    `Paid: ${money(invoice.paidCents)}`,
    `Amount due: ${money(invoice.amountDueCents)}`,
    ...(invoice.status === "issued" && seller.bank.iban ? ["", `Pay by bank transfer to ${seller.bank.iban}${seller.bank.name ? ` (${seller.bank.name})` : ""}, reference ${invoice.number}.`] : []),
    "",
  ].join("\n");
}

/** Public invoice page: GET /i/:token (the private link from the invoice email). */
export const invoicesSite = new Hono<AppEnv>().get("/i/:token", async (c) => {
  const token = c.req.param("token");
  const doc = await getPublicInvoice(getContext(c), token);
  if (!doc) return renderNotFound(c);
  const { invoice, lines, seller, buyer } = doc;
  const locale = config.locale;
  const money = (cents: number) => formatMoney(cents, invoice.currency, locale);
  const showPayment = invoice.status === "issued" && invoice.amountDueCents > 0 && Boolean(seller.bank.iban);

  return renderPage(c, {
    meta: {
      title: `Invoice ${invoice.number}`,
      description: `Invoice ${invoice.number} from ${seller.name} to ${buyer.name}.`,
      path: `/i/${token}`,
      noindex: true,
    },
    markdown: markdown(doc, locale),
    body: (
      <DocumentView
        title={`Invoice ${invoice.number}`}
        status={invoice.status === "paid" ? badge("Paid", "paid") : invoice.status === "void" ? badge("Void", "void") : null}
        seller={seller}
        buyer={buyer}
        dates={[
          ["Issue date", invoice.issueDate],
          ["Due date", invoice.dueDate],
        ]}
        lines={lines}
        totals={documentTotals(lines)}
        currency={invoice.currency}
        locale={locale}
        notes={invoice.notes}
        extraTotals={[
          ["Paid", invoice.paidCents],
          ["Amount due", invoice.amountDueCents],
        ]}
        footer={
          <>
            {invoice.status === "void" ? (
              <p className="notice error" role="status" style={{ marginTop: 24 }}>
                This invoice was voided{invoice.voidedAt ? ` on ${formatDate(invoice.voidedAt.slice(0, 10), locale)}` : ""}. Do not pay it. Contact {seller.name} if you have questions.
              </p>
            ) : null}
            {invoice.status === "paid" ? (
              <p className="notice success" style={{ marginTop: 24 }}>
                Paid in full. Thank you.
              </p>
            ) : null}
            {showPayment ? (
              <section className="notice" aria-labelledby="pay-heading" style={{ marginTop: 24 }}>
                <h2 id="pay-heading" style={{ fontSize: "1.125rem" }}>
                  How to pay
                </h2>
                <p style={{ margin: 0 }}>Pay by bank transfer by {formatDate(invoice.dueDate, locale)}.</p>
                <table style={{ width: "auto", margin: "8px 0 0" }}>
                  <tbody>
                    {seller.bank.name ? (
                      <tr>
                        <td className="muted">Bank</td>
                        <td>{seller.bank.name}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td className="muted">Recipient</td>
                      <td>{seller.name}</td>
                    </tr>
                    <tr>
                      <td className="muted">IBAN</td>
                      <td>{seller.bank.iban}</td>
                    </tr>
                    <tr>
                      <td className="muted">Payment reference</td>
                      <td>{invoice.number}</td>
                    </tr>
                    <tr>
                      <td className="muted">Amount due</td>
                      <td className="price">{money(invoice.amountDueCents)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            ) : null}
            {seller.footer ? <p style={{ marginTop: 24, whiteSpace: "pre-line" }}>{seller.footer}</p> : null}
            <p className="muted small no-print" style={{ marginTop: 24 }}>
              Use your browser's print command to save a PDF.
            </p>
          </>
        }
      />
    ),
  });
});

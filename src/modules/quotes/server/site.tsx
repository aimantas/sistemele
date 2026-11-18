import { Hono, type Context } from "hono";
import { formatDate } from "@/shared/dates";
import { formatMoney, formatPercentBps } from "@/shared/money";
import { getContext } from "@/worker/context";
import { appOrigin, type AppEnv } from "@/worker/env";
import { DocumentView } from "@/worker/site/DocumentView";
import { renderPage } from "@/worker/site/render";
import { quoteStatusLabel, type QuoteDetail } from "../shared/schema";
import { findQuoteByToken } from "./service";

const statusText: Record<QuoteDetail["status"], string> = {
  draft: "Draft",
  sent: "Awaiting your answer",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

function markdownFor(quote: QuoteDetail, token: string, origin: string, locale: string): string {
  const money = (cents: number) => formatMoney(cents, quote.currency, locale);
  const rows = quote.lines.map((line) => `| ${line.description.replace(/\|/gu, "\\|")} | ${line.quantity} ${line.unit} | ${money(line.unitPriceCents)} | ${formatPercentBps(line.vatRateBps, locale)} | ${money(line.subtotalCents)} |`);
  return [
    `# Quote ${quote.number}`,
    "",
    `- Status: ${quoteStatusLabel(quote.status)}`,
    `- From: ${quote.seller.name}`,
    `- To: ${quote.buyer.name}`,
    `- Issue date: ${quote.issueDate}`,
    `- Valid until: ${quote.validUntil}`,
    "",
    "| Description | Qty | Unit price | VAT | Net |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `- Net: ${money(quote.subtotalCents)}`,
    ...quote.vatGroups.map((group) => `- VAT ${formatPercentBps(group.rateBps, locale)}: ${money(group.vatCents)}`),
    `- **Total: ${money(quote.totalCents)}**`,
    ...(quote.notes ? ["", quote.notes] : []),
    ...(quote.terms ? ["", "## Terms", "", quote.terms] : []),
    ...(quote.status === "sent"
      ? ["", "## Answer", "", `Accept: POST ${origin}/api/public/quotes/${token}/accept`, `Decline: POST ${origin}/api/public/quotes/${token}/decline`]
      : []),
    "",
  ].join("\n");
}

async function notFoundPage(c: Context<AppEnv>, path: string): Promise<Response> {
  const business = await getContext(c).business();
  return renderPage(c, {
    status: 404,
    meta: { title: "Quote link not found", description: "This quote link is not valid.", path, noindex: true },
    markdown: "# Quote link not found\n\nThe link may have been replaced by a newer one.\n",
    body: (
      <section className="section">
        <div className="wrap narrow">
          <h1>Quote link not found</h1>
          <p className="lead">The link may have been replaced by a newer one, or the quote is being updated.</p>
          <p>
            Ask {business.name} for the latest link
            {business.email ? (
              <>
                {" "}
                at <a href={`mailto:${business.email}`}>{business.email}</a>
              </>
            ) : null}
            .
          </p>
        </div>
      </section>
    ),
  });
}

/** Customer-facing quote at /q/:token. Private: noindex, no caching. */
export const quotesSite = new Hono<AppEnv>().get("/q/:token", async (c) => {
  const ctx = getContext(c);
  const token = c.req.param("token");
  const path = `/q/${token}`;
  const quote = await findQuoteByToken(ctx, token);
  if (!quote) return notFoundPage(c, path);

  const business = await ctx.business();
  const done = c.req.query("done");
  const error = c.req.query("error");
  const locale = ctx.locale;
  const total = formatMoney(quote.totalCents, quote.currency, locale);
  const contactLine = business.email ? (
    <>
      {" "}
      Questions? Write to <a href={`mailto:${business.email}?subject=${encodeURIComponent(`Quote ${quote.number}`)}`}>{business.email}</a>.
    </>
  ) : null;

  let answer = null;
  if (quote.status === "accepted") {
    answer = (
      <p className="notice success" role="status">
        {done === "accepted" ? "Thank you. You accepted this quote." : `This quote was accepted${quote.respondedAt ? ` on ${formatDate(quote.respondedAt, locale)}` : ""}.`} {business.name} will contact you about the next steps.{contactLine}
      </p>
    );
  } else if (quote.status === "declined") {
    answer = (
      <p className="notice" role="status">
        {done === "declined" ? "Thank you for letting us know. You declined this quote." : "This quote was declined."} Need a different offer?{contactLine ?? ` Contact ${business.name}.`}
      </p>
    );
  } else if (quote.status === "expired") {
    answer = (
      <p className="notice error" role="status">
        This quote expired on {formatDate(quote.validUntil, locale)}. Ask {business.name} for an updated quote.{contactLine}
      </p>
    );
  } else if (quote.status === "sent") {
    answer = (
      <div className="no-print" style={{ marginTop: 32 }}>
        {error ? (
          <p className="notice error" role="alert">
            {error === "rate_limited" ? "Too many attempts from your connection. Try again in a few minutes." : "This quote can no longer be answered. Reload the page to see its status."}
          </p>
        ) : null}
        <h2 style={{ fontSize: "1.25rem" }}>Your answer</h2>
        <p>
          Accepting confirms the order at {total} as shown above. {business.name} will contact you about the next steps.{contactLine}
        </p>
        <div className="actions" style={{ marginTop: 16 }}>
          <form method="post" action={`/api/public/quotes/${token}/accept`}>
            <button className="button primary" type="submit">
              Accept quote
            </button>
          </form>
          <form method="post" action={`/api/public/quotes/${token}/decline`}>
            <button className="button" type="submit">
              Decline
            </button>
          </form>
        </div>
      </div>
    );
  }

  return renderPage(c, {
    meta: { title: `Quote ${quote.number}`, description: `Quote ${quote.number} from ${business.name}: ${total}, valid until ${formatDate(quote.validUntil, locale)}.`, path, noindex: true },
    markdown: markdownFor(quote, token, appOrigin(c.env), locale),
    body: (
      <DocumentView
        title={`Quote ${quote.number}`}
        status={<span className={quote.status === "sent" || quote.status === "accepted" ? "badge" : "badge out"}>{statusText[quote.status]}</span>}
        seller={quote.seller}
        buyer={quote.buyer}
        dates={[
          ["Issue date", quote.issueDate],
          ["Valid until", quote.validUntil],
          [quote.status === "accepted" ? "Accepted on" : "Declined on", quote.status === "accepted" || quote.status === "declined" ? quote.respondedAt : null],
        ]}
        lines={quote.lines}
        totals={{ subtotalCents: quote.subtotalCents, vatCents: quote.vatCents, totalCents: quote.totalCents, vatGroups: quote.vatGroups }}
        currency={quote.currency}
        locale={locale}
        notes={quote.notes}
        footer={
          <>
            {quote.terms ? (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: "1.125rem" }}>Terms</h2>
                <p style={{ whiteSpace: "pre-line" }}>{quote.terms}</p>
              </div>
            ) : null}
            {answer}
          </>
        }
      />
    ),
  });
});

import type { PartySnapshot } from "@/shared/lines";
import { formatMoney, formatPercentBps } from "@/shared/money";
import { useFormat } from "@/app/lib/format";
import type { QuoteDetail } from "../shared/schema";
import { DocumentLogo } from "@/app/components/DocumentLogo";

function Party({ label, party }: { label: string; party: PartySnapshot }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</h3>
      <p className="font-medium">{party.name}</p>
      <div className="text-sm text-foreground/80">
        {party.companyCode ? <p>Company code {party.companyCode}</p> : null}
        {party.vatCode ? <p>VAT {party.vatCode}</p> : null}
        {party.address ? <p>{party.address}</p> : null}
        {party.email ? <p className="break-words">{party.email}</p> : null}
        {party.phone ? <p>{party.phone}</p> : null}
      </div>
    </div>
  );
}

/** The quote as the customer sees it. Also the print layout (see QuoteDetailPage). */
export function QuoteDocument({ quote }: { quote: QuoteDetail }) {
  const format = useFormat();
  const money = (cents: number) => formatMoney(cents, quote.currency, format.locale);
  return (
    <article data-print-root className="rounded-xl border border-border bg-card p-5 sm:p-8" aria-label={`Quote ${quote.number}`}>
      <DocumentLogo />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Quote {quote.number}</h2>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 text-sm">
          <dt className="text-muted-foreground">Issue date</dt>
          <dd className="tabular">{format.date(quote.issueDate)}</dd>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd className="tabular">{format.date(quote.validUntil)}</dd>
        </dl>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Party label="From" party={quote.seller} />
        <Party label="To" party={quote.buyer} />
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="py-2 pr-3">
                Description
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Unit price
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                VAT
              </th>
              <th scope="col" className="py-2 pl-3 text-right">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-b border-border align-top">
                <td className="py-2.5 pr-3">
                  {line.description}
                  {line.discountBps ? <span className="text-muted-foreground"> (−{formatPercentBps(line.discountBps, format.locale)})</span> : null}
                </td>
                <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">
                  {format.number(line.quantity)} {line.unit}
                </td>
                <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">{money(line.unitPriceCents)}</td>
                <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">{format.vat(line.vatRateBps)}</td>
                <td className="tabular py-2.5 pl-3 text-right whitespace-nowrap">{money(line.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="tabular mt-4 ml-auto grid w-full max-w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Net</dt>
        <dd className="text-right">{money(quote.subtotalCents)}</dd>
        {quote.vatGroups.map((group) => (
          <div key={group.rateBps} className="contents">
            <dt className="text-muted-foreground">VAT {format.vat(group.rateBps)}</dt>
            <dd className="text-right">{money(group.vatCents)}</dd>
          </div>
        ))}
        <dt className="mt-1 border-t border-foreground pt-2 text-base font-semibold">Total</dt>
        <dd className="mt-1 border-t border-foreground pt-2 text-right text-base font-semibold">{money(quote.totalCents)}</dd>
      </dl>
      {quote.notes ? <p className="mt-6 whitespace-pre-line text-foreground/80">{quote.notes}</p> : null}
      {quote.terms ? (
        <div className="mt-6">
          <h3 className="mb-1 text-sm font-semibold">Terms</h3>
          <p className="text-sm whitespace-pre-line text-foreground/80">{quote.terms}</p>
        </div>
      ) : null}
    </article>
  );
}

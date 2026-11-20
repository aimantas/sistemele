import { useContext, type ReactNode } from "react";
import type { PartySnapshot } from "@/shared/lines";
import { formatDate } from "@/shared/dates";
import { formatMoney, formatPercentBps, type VatGroup } from "@/shared/money";
import { SiteBrandContext } from "./brand-context";
import { BrandLockup } from "./Layout";

export interface DocumentViewProps {
  /** "Quote Q-2026-0001" or "Invoice INV-2026-0001". */
  title: string;
  status?: ReactNode;
  seller: PartySnapshot;
  buyer: PartySnapshot;
  /** Label/date pairs such as ["Issue date", "2026-11-18"]. */
  dates: Array<[string, string | null]>;
  lines: Array<{ description: string; quantity: number; unit: string; unitPriceCents: number; vatRateBps: number; discountBps: number; subtotalCents: number }>;
  totals: { subtotalCents: number; vatCents: number; totalCents: number; vatGroups: VatGroup[] };
  currency: string;
  locale: string;
  notes?: string;
  /** Rows after Total, e.g. Paid and Amount due. The last row is emphasised. */
  extraTotals?: Array<[string, number]>;
  /** Bank transfer block, accept buttons … */
  footer?: ReactNode;
}

function Party({ label, party }: { label: string; party: PartySnapshot }) {
  return (
    <div>
      <h3>{label}</h3>
      <p>
        <strong>{party.name}</strong>
      </p>
      {party.companyCode ? <p>Company code {party.companyCode}</p> : null}
      {party.vatCode ? <p>VAT {party.vatCode}</p> : null}
      {party.address ? <p>{party.address}</p> : null}
      {party.email ? <p>{party.email}</p> : null}
      {party.phone ? <p>{party.phone}</p> : null}
    </div>
  );
}

/** Printable quote/invoice for public pages (/q/:token, /i/:token). Prints cleanly. */
export function DocumentView(props: DocumentViewProps) {
  const money = (cents: number) => formatMoney(cents, props.currency, props.locale);
  const brand = useContext(SiteBrandContext);
  return (
    <section className="section">
      <div className="wrap">
        <article className="doc">
          {brand.logoUrl ? (
            <div className="doc-logo">
              <BrandLockup name={brand.name} logoUrl={brand.logoUrl} logoMark={brand.logoMark} />
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
            <h1 style={{ fontSize: "1.75rem" }}>{props.title}</h1>
            {props.status}
          </div>
          <div className="meta-grid">
            <Party label="From" party={props.seller} />
            <Party label="To" party={props.buyer} />
            <div>
              {props.dates
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <p key={label}>
                    <span className="muted">{label}:</span> {formatDate(value, props.locale)}
                  </p>
                ))}
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">VAT</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {props.lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      {line.description}
                      {line.discountBps ? <span className="muted"> (−{formatPercentBps(line.discountBps, props.locale)})</span> : null}
                    </td>
                    <td className="num">
                      {line.quantity} {line.unit}
                    </td>
                    <td className="num">{money(line.unitPriceCents)}</td>
                    <td className="num">{formatPercentBps(line.vatRateBps, props.locale)}</td>
                    <td className="num">{money(line.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <table className="totals" style={{ width: "auto", marginLeft: "auto" }}>
            <tbody>
              <tr>
                <td>Net</td>
                <td className="num">{money(props.totals.subtotalCents)}</td>
              </tr>
              {props.totals.vatGroups.map((group) => (
                <tr key={group.rateBps}>
                  <td>VAT {formatPercentBps(group.rateBps, props.locale)}</td>
                  <td className="num">{money(group.vatCents)}</td>
                </tr>
              ))}
              <tr>
                <td>Total</td>
                <td className="num">{money(props.totals.totalCents)}</td>
              </tr>
              {(props.extraTotals ?? []).map(([label, cents]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{money(cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {props.notes ? <p style={{ whiteSpace: "pre-line", marginTop: 24 }}>{props.notes}</p> : null}
          {props.footer}
        </article>
      </div>
    </section>
  );
}

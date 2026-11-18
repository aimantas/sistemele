/**
 * Money rules shared by the browser and the Worker.
 * Amounts are integer cents. VAT and discounts are integer basis points
 * (2100 = 21%). The server recalculates every total; client totals are
 * previews only.
 */

export interface PricedLine {
  quantity: number;
  unitPriceCents: number;
  vatRateBps: number;
  discountBps?: number;
}

export interface VatGroup {
  rateBps: number;
  baseCents: number;
  vatCents: number;
}

export interface DocumentTotals {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  vatGroups: VatGroup[];
}

/** Net amount of one line after discount, rounded to whole cents. */
export function lineSubtotalCents(line: PricedLine): number {
  const gross = line.quantity * line.unitPriceCents;
  const discount = (gross * (line.discountBps ?? 0)) / 10_000;
  return Math.round(gross - discount);
}

/** VAT is rounded once per rate group, as most EU invoicing rules expect. */
export function documentTotals(lines: readonly PricedLine[]): DocumentTotals {
  const groups = new Map<number, number>();
  let subtotalCents = 0;
  for (const line of lines) {
    const subtotal = lineSubtotalCents(line);
    subtotalCents += subtotal;
    groups.set(line.vatRateBps, (groups.get(line.vatRateBps) ?? 0) + subtotal);
  }
  const vatGroups = [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rateBps, baseCents]) => ({ rateBps, baseCents, vatCents: Math.round((baseCents * rateBps) / 10_000) }));
  const vatCents = vatGroups.reduce((sum, group) => sum + group.vatCents, 0);
  return { subtotalCents, vatCents, totalCents: subtotalCents + vatCents, vatGroups };
}

export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function formatPercentBps(bps: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(bps / 10_000);
}

/** Parses "12,50" or "12.50" into 1250. Returns null for anything else. */
export function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/gu, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/u.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

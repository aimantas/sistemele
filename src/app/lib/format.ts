import { useMemo } from "react";
import { config } from "../../../sistemele.config";
import { formatDate, formatDateTime } from "@/shared/dates";
import { formatMoney } from "@/shared/money";

/** Locale-aware formatters. Locale and currency come from sistemele.config.ts. */
export function useFormat() {
  return useMemo(() => {
    const locale = config.locale;
    const currency = config.currency;
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
    return {
      locale,
      currency,
      money: (cents: number | null | undefined, code: string = currency) => (cents == null ? "—" : formatMoney(cents, code, locale)),
      number: (value: number) => number.format(value),
      percent: (ratio: number) => percent.format(ratio),
      vat: (bps: number) => percent.format(bps / 10_000),
      date: (value: string | null | undefined) => formatDate(value, locale),
      dateTime: (value: string | null | undefined) => formatDateTime(value, locale),
      relative: (value: string | null | undefined) => (value ? relativeTime(value, locale) : "—"),
    };
  }, []);
}

function relativeTime(value: string, locale: string): string {
  const diffSeconds = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [["second", 60], ["minute", 60], ["hour", 24], ["day", 30], ["month", 12], ["year", Infinity]];
  let amount = diffSeconds;
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size) return rtf.format(Math.round(amount), unit);
    amount /= size;
  }
  return value;
}

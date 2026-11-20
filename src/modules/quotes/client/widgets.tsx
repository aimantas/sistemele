import { Link } from "react-router";
import { config } from "../../../../sistemele.config";
import { todayDate } from "@/shared/dates";
import { formatMoney } from "@/shared/money";
import { useFormat } from "@/app/lib/format";
import { ErrorState, Spinner } from "@/app/ui";
import { useQuotes } from "./api";
import { daysBetween, plural } from "./parts";

/** Sent quotes waiting for the customer, oldest first, with expiry warnings. */
export function AwaitingQuotesWidget() {
  const format = useFormat();
  const quotes = useQuotes({ status: "awaiting", limit: 10 });
  if (quotes.error) return <ErrorState error={quotes.error} retry={() => quotes.refetch()} />;
  if (!quotes.data) return <Spinner />;
  if (quotes.data.items.length === 0) return <p className="text-sm text-muted-foreground">No quotes waiting for an answer.</p>;
  const today = todayDate(config.timezone);
  return (
    <ul className="grid gap-1">
      {quotes.data.items.map((quote) => {
        const waiting = quote.sentAt ? Math.max(0, daysBetween(todayDate(config.timezone, new Date(quote.sentAt)), today)) : 0;
        const left = daysBetween(today, quote.validUntil);
        const expiry =
          quote.status === "expired" ? (
            <span className="font-medium text-destructive">expired</span>
          ) : left <= 3 ? (
            <span className="font-medium text-warning">{left === 0 ? "expires today" : `expires in ${plural(left, "day")}`}</span>
          ) : null;
        return (
          <li key={quote.id}>
            <Link to={`/app/quotes/${quote.id}`} className="flex items-start justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-background">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {quote.number} · {quote.contactName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {waiting === 0 ? "sent today" : `waiting ${plural(waiting, "day")}`}
                  {expiry ? <> · {expiry}</> : null}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm">{formatMoney(quote.totalCents, quote.currency, format.locale)}</span>
            </Link>
          </li>
        );
      })}
      {quotes.data.total > quotes.data.items.length ? (
        <li>
          <Link to="/app/quotes?status=sent" className="block px-1 py-1.5 text-sm font-medium text-primary hover:underline">
            {plural(quotes.data.total - quotes.data.items.length, "more quote")} waiting
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

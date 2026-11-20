import { clsx } from "clsx";
import { FileText, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { formatMoney } from "@/shared/money";
import { useFormat } from "@/app/lib/format";
import { Button, ButtonLink, EmptyState, ErrorState, Input, PageHeader, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { QUOTE_STATUSES, quoteStatusIds, type QuoteStatus } from "../shared/schema";
import { useQuotes } from "./api";
import { QuoteStatusBadge } from "./parts";

const PAGE_SIZE = 50;
const TABS: Array<{ id: QuoteStatus | "all"; label: string }> = [{ id: "all", label: "All" }, ...QUOTE_STATUSES.map(({ id, label }) => ({ id, label }))];

export default function QuotesPage() {
  const format = useFormat();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [term, setTerm] = useState(q);
  const statusParam = params.get("status") ?? "";
  const status = (quoteStatusIds as string[]).includes(statusParam) ? (statusParam as QuoteStatus) : undefined;
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);
  const quotes = useQuotes({ status, q: q || undefined, limit: PAGE_SIZE, offset });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (term !== q)
        setParams((current) => {
          const next = new URLSearchParams(current);
          if (term) next.set("q", term);
          else next.delete("q");
          next.delete("offset");
          return next;
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [term, q, setParams]);

  const setStatus = (value: QuoteStatus | "all") =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === "all") next.delete("status");
      else next.set("status", value);
      next.delete("offset");
      return next;
    });
  const setOffset = (value: number) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("offset", String(value));
      return next;
    });

  const total = quotes.data?.total ?? 0;
  const filtered = Boolean(q || status);
  return (
    <div>
      <PageHeader
        title="Quotes"
        actions={
          <ButtonLink to="/app/quotes/new" variant="default" icon={<Plus />}>
            New quote
          </ButtonLink>
        }
      />
      <div className="mb-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 border-b border-border" role="group" aria-label="Filter by status">
          {TABS.map((tab) => {
            const active = (status ?? "all") === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(tab.id)}
                className={clsx("-mb-px h-10 border-b-2 px-3 text-sm font-medium whitespace-nowrap", active ? "border-primary text-primary" : "border-transparent text-foreground/80 hover:text-foreground")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Search quotes" placeholder="Search number or contact" className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>
        <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {quotes.data ? `${total} quote${total === 1 ? "" : "s"}` : null}
        </p>
      </div>

      {quotes.error ? <ErrorState error={quotes.error} retry={() => quotes.refetch()} /> : null}
      {quotes.isLoading ? <Spinner /> : null}
      {quotes.data && quotes.data.items.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={filtered ? "No quotes match" : "No quotes yet"}
          description={filtered ? "Try another status or search." : "Price a job for a contact, send it, and the customer accepts online."}
          action={
            filtered ? null : (
              <ButtonLink to="/app/quotes/new" variant="default" icon={<Plus />}>
                New quote
              </ButtonLink>
            )
          }
        />
      ) : null}
      {quotes.data && quotes.data.items.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Quote</Th>
                <Th className="hidden sm:table-cell">Contact</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Issued</Th>
                <Th className="hidden lg:table-cell">Valid until</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {quotes.data.items.map((quote) => (
                <Tr key={quote.id}>
                  <Td>
                    <Link to={`/app/quotes/${quote.id}`} className="font-medium whitespace-nowrap text-foreground hover:text-primary hover:underline">
                      {quote.number}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground sm:hidden">{quote.contactName}</p>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <span className="block max-w-xs truncate">{quote.contactName}</span>
                    {quote.dealTitle ? <span className="block max-w-xs truncate text-xs text-muted-foreground">{quote.dealTitle}</span> : null}
                  </Td>
                  <Td>
                    <QuoteStatusBadge status={quote.status} />
                  </Td>
                  <Td className="hidden whitespace-nowrap text-foreground/80 md:table-cell">{format.date(quote.issueDate)}</Td>
                  <Td className={clsx("hidden whitespace-nowrap lg:table-cell", quote.status === "expired" ? "text-warning" : "text-foreground/80")}>{format.date(quote.validUntil)}</Td>
                  <Td align="right" className="font-medium">
                    {formatMoney(quote.totalCents, quote.currency, format.locale)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

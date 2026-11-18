import { clsx } from "clsx";
import { Plus, Receipt, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useFormat } from "@/app/lib/format";
import { Button, ButtonLink, EmptyState, ErrorState, Input, PageHeader, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { INVOICE_FILTERS, type InvoiceFilter } from "../shared/schema";
import { useInvoices } from "./api";
import { InvoiceStatusBadge } from "./StatusBadge";

const PAGE_SIZE = 50;

const TABS: Array<{ id: InvoiceFilter | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "issued", label: "Issued" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
];

const EMPTY: Record<InvoiceFilter | "all", string> = {
  all: "No invoices yet",
  draft: "No drafts",
  issued: "No issued invoices waiting for payment",
  overdue: "Nothing overdue",
  paid: "No paid invoices yet",
  void: "No void invoices",
};

export default function InvoicesPage() {
  const format = useFormat();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [term, setTerm] = useState(q);
  const rawStatus = params.get("status");
  const status = INVOICE_FILTERS.find((value) => value === rawStatus);
  const offset = Number(params.get("offset") ?? 0) || 0;
  const invoices = useInvoices({ status, q, limit: PAGE_SIZE, offset });

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

  const selectTab = (id: InvoiceFilter | "all") =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id === "all") next.delete("status");
      else next.set("status", id);
      next.delete("offset");
      return next;
    });

  const total = invoices.data?.total ?? 0;
  const activeTab = status ?? "all";
  return (
    <div>
      <PageHeader
        title="Invoices"
        actions={
          <ButtonLink to="/app/invoices/new" variant="primary" icon={<Plus />}>
            New invoice
          </ButtonLink>
        }
      />
      <div className="mb-4 grid gap-3">
        <nav aria-label="Filter by status" className="-mx-1 overflow-x-auto px-1">
          <ul className="flex gap-1 border-b border-line">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={() => selectTab(tab.id)}
                  className={clsx(
                    "-mb-px h-10 border-b-2 px-3 text-sm font-medium whitespace-nowrap",
                    activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input type="search" aria-label="Search invoices" placeholder="Search number or customer" className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} />
          </div>
          <p className="ml-auto text-sm text-muted" aria-live="polite">
            {invoices.data ? `${total} invoice${total === 1 ? "" : "s"}` : null}
          </p>
        </div>
      </div>

      {invoices.error ? <ErrorState error={invoices.error} retry={() => invoices.refetch()} /> : null}
      {invoices.isLoading ? <Spinner /> : null}
      {invoices.data && invoices.data.items.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={q ? "No invoices match" : EMPTY[activeTab]}
          description={q ? "Try another number or customer name." : activeTab === "all" ? "Create one from scratch or from an accepted quote." : undefined}
          action={
            !q && activeTab === "all" ? (
              <ButtonLink to="/app/invoices/new" variant="primary" icon={<Plus />}>
                New invoice
              </ButtonLink>
            ) : null
          }
        />
      ) : null}
      {invoices.data && invoices.data.items.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th className="hidden md:table-cell">Customer</Th>
                <Th className="hidden lg:table-cell">Issued</Th>
                <Th className="hidden sm:table-cell">Due</Th>
                <Th align="right" className="hidden lg:table-cell">
                  Total
                </Th>
                <Th align="right">Amount due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.data.items.map((invoice) => (
                <Tr key={invoice.id}>
                  <Td>
                    <Link to={`/app/invoices/${invoice.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                      {invoice.number ?? "Draft"}
                    </Link>
                    <p className="truncate text-xs text-muted md:hidden">{invoice.contactName}</p>
                  </Td>
                  <Td className="hidden md:table-cell">{invoice.contactName}</Td>
                  <Td className="hidden whitespace-nowrap text-ink-soft lg:table-cell">{invoice.issueDate ? format.date(invoice.issueDate) : <span className="text-muted">—</span>}</Td>
                  <Td className={clsx("hidden whitespace-nowrap sm:table-cell", invoice.overdue ? "font-medium text-danger" : "text-ink-soft")}>
                    {invoice.dueDate ? format.date(invoice.dueDate) : <span className="text-muted">—</span>}
                    {invoice.overdue ? <span className="block text-xs">{invoice.daysOverdue} days late</span> : null}
                  </Td>
                  <Td align="right" className="hidden lg:table-cell">
                    {format.money(invoice.totalCents, invoice.currency)}
                  </Td>
                  <Td align="right" className="font-medium">
                    {invoice.status === "void" ? <span className="text-muted">—</span> : format.money(invoice.amountDueCents, invoice.currency)}
                  </Td>
                  <Td>
                    <InvoiceStatusBadge invoice={invoice} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" disabled={offset === 0} onClick={() => setParams((p) => (p.set("offset", String(Math.max(0, offset - PAGE_SIZE))), p))}>
                Previous
              </Button>
              <span className="text-sm text-muted">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setParams((p) => (p.set("offset", String(offset + PAGE_SIZE)), p))}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

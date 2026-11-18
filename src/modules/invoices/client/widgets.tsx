import { Link } from "react-router";
import { useFormat } from "@/app/lib/format";
import { ErrorState, Spinner } from "@/app/ui";
import { useInvoices } from "./api";

const SHOWN = 6;

/** Dashboard card: issued invoices past their due date, longest overdue first. */
export function OverdueInvoicesWidget() {
  const format = useFormat();
  const overdue = useInvoices({ status: "overdue", limit: SHOWN });
  if (overdue.error) return <ErrorState error={overdue.error} retry={() => overdue.refetch()} />;
  if (!overdue.data) return <Spinner />;
  if (overdue.data.items.length === 0) return <p className="text-sm text-muted">No overdue invoices.</p>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1">
        {overdue.data.items.map((invoice) => (
          <li key={invoice.id}>
            <Link to={`/app/invoices/${invoice.id}`} className="flex items-center justify-between gap-3 rounded-control px-1 py-1.5 hover:bg-paper">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {invoice.number} <span className="font-normal text-muted">· {invoice.contactName}</span>
                </span>
                <span className="block text-xs font-medium text-danger">
                  {invoice.daysOverdue} day{invoice.daysOverdue === 1 ? "" : "s"} overdue
                </span>
              </span>
              <span className="tabular shrink-0 text-sm font-medium">{format.money(invoice.amountDueCents, invoice.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {overdue.data.total > SHOWN ? (
        <Link to="/app/invoices?status=overdue" className="px-1 text-sm font-medium text-brand hover:underline">
          All {overdue.data.total} overdue invoices
        </Link>
      ) : null}
    </div>
  );
}

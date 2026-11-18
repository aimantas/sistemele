import { Badge } from "@/app/ui";
import type { Invoice } from "../shared/schema";

const tones = { draft: "neutral", issued: "info", paid: "success", void: "neutral" } as const;
const labels = { draft: "Draft", issued: "Issued", paid: "Paid", void: "Void" } as const;

/** Stored status, with "Overdue" in place of Issued once the due date has passed. */
export function InvoiceStatusBadge({ invoice }: { invoice: Pick<Invoice, "status" | "overdue"> }) {
  if (invoice.overdue) return <Badge tone="danger">Overdue</Badge>;
  return <Badge tone={tones[invoice.status]}>{labels[invoice.status]}</Badge>;
}

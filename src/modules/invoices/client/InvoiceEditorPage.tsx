import { ArrowLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { emptyLine, LineItemsEditor } from "@/app/components/LineItemsEditor";
import { ApiError, fieldError } from "@/app/lib/api";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Spinner, Textarea } from "@/app/ui";
import { ContactPicker } from "@/modules/crm/client/ContactPicker";
import type { LineInput } from "@/shared/lines";
import type { InvoiceDetail } from "../shared/schema";
import { useBusiness, useInvoice, useSaveInvoice } from "./api";

/** /app/invoices/new (optional ?contactId=) and /app/invoices/:id/edit. Drafts only. */
export default function InvoiceEditorPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const invoice = useInvoice(id);
  const business = useBusiness();

  const back = (
    <Link to={id ? `/app/invoices/${id}` : "/app/invoices"} className="inline-flex items-center gap-1 text-muted hover:text-ink">
      <ArrowLeft className="size-4" /> {id ? "Invoice" : "Invoices"}
    </Link>
  );

  if ((id && invoice.isLoading) || business.isLoading) return <Spinner />;
  if (id && (invoice.error || !invoice.data)) return <ErrorState error={invoice.error} retry={() => invoice.refetch()} />;
  if (business.error || !business.data) return <ErrorState error={business.error} retry={() => business.refetch()} />;

  if (invoice.data && invoice.data.status !== "draft") {
    return (
      <div>
        <PageHeader back={back} title={`Edit ${invoice.data.number}`} />
        <EmptyState
          title="Issued invoices cannot be edited"
          description="Void it and create a new invoice to correct it."
          action={
            <ButtonLink to={`/app/invoices/${id}`} variant="primary">
              Back to the invoice
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <InvoiceForm
      key={invoice.data?.updatedAt ?? "new"}
      back={back}
      invoice={invoice.data}
      initialContactId={params.get("contactId")}
      defaultVatRateBps={business.data.business.defaultVatRateBps}
      paymentTermsDays={business.data.business.paymentTermsDays}
    />
  );
}

function InvoiceForm({ back, invoice, initialContactId, defaultVatRateBps, paymentTermsDays }: { back: ReactNode; invoice?: InvoiceDetail; initialContactId: string | null; defaultVatRateBps: number; paymentTermsDays: number }) {
  const navigate = useNavigate();
  const save = useSaveInvoice(invoice?.id);
  const [contactId, setContactId] = useState<string | null>(invoice?.contactId ?? initialContactId);
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [lines, setLines] = useState<LineInput[]>(
    invoice?.lines.map(({ productId, description, quantity, unit, unitPriceCents, vatRateBps, discountBps }) => ({ productId, description, quantity, unit, unitPriceCents, vatRateBps, discountBps })) ?? [
      emptyLine(defaultVatRateBps),
    ],
  );
  const issues = save.error instanceof ApiError ? save.error.issues : {};

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ contactId: contactId ?? "", dueDate: dueDate || null, notes, lines }, { onSuccess: (saved) => navigate(`/app/invoices/${saved.id}`) });
      }}
    >
      <PageHeader back={back} title={invoice ? "Edit draft invoice" : "New invoice"} />
      <div className="grid gap-6">
        <Card className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="Customer" error={fieldError(save.error, "contactId")}>
            {(props) => <ContactPicker id={props.id} invalid={Boolean(props["aria-invalid"])} value={contactId} onChange={(contact) => setContactId(contact?.id ?? null)} />}
          </Field>
          <Field label="Due date" error={fieldError(save.error, "dueDate")} hint={dueDate ? undefined : `${paymentTermsDays} days after issue`}>
            {(props) => <Input {...props} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />}
          </Field>
        </Card>
        <section aria-labelledby="lines-heading" className="grid gap-3">
          <h2 id="lines-heading" className="text-base font-semibold">
            Lines
          </h2>
          <LineItemsEditor lines={lines} onChange={setLines} defaultVatRateBps={defaultVatRateBps} errors={issues} />
        </section>
        <Field label="Notes on the invoice" error={fieldError(save.error, "notes")}>
          {(props) => <Textarea {...props} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />}
        </Field>
        <FormError error={save.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink to={invoice ? `/app/invoices/${invoice.id}` : "/app/invoices"} variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save draft
          </Button>
        </div>
      </div>
    </form>
  );
}

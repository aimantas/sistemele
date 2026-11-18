import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { config } from "../../../../sistemele.config";
import { addDays, todayDate } from "@/shared/dates";
import type { LineInput } from "@/shared/lines";
import { LineItemsEditor, emptyLine } from "@/app/components/LineItemsEditor";
import { ApiError } from "@/app/lib/api";
import { Button, ButtonLink, Card, CardHeader, ErrorState, Field, FormError, Input, PageHeader, Select, Spinner, Textarea, useToast } from "@/app/ui";
import { ContactPicker } from "@/modules/crm/client/ContactPicker";
import { useDeals } from "@/modules/crm/client/api";
import { QUOTE_VALIDITY_DAYS, type QuoteDetail } from "../shared/schema";
import { useBusinessProfile, useQuote, useSaveQuote } from "./api";

interface FormState {
  contactId: string | null;
  dealId: string | null;
  issueDate: string;
  validUntil: string;
  notes: string;
  terms: string;
  lines: LineInput[];
}

/** /app/quotes/new (prefill with ?contactId=&dealId=) and /app/quotes/:id/edit. */
export default function QuoteEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const business = useBusinessProfile();
  const quote = useQuote(id ?? "");

  if (business.isLoading || (id && quote.isLoading)) return <Spinner />;
  if (business.error) return <ErrorState error={business.error} retry={() => business.refetch()} />;
  if (id && (quote.error || !quote.data)) return <ErrorState error={quote.error} retry={() => quote.refetch()} />;
  const defaultVat = business.data?.defaultVatRateBps ?? config.business.defaultVatRateBps;

  if (quote.data && quote.data.status !== "draft") {
    return (
      <div>
        <PageHeader back={<BackLink to={`/app/quotes/${quote.data.id}`} label={`Quote ${quote.data.number}`} />} title={`Edit quote ${quote.data.number}`} />
        <Card className="p-5">
          <p>Only drafts can be edited. Open the quote and choose Revise to return it to draft; the customer link stops working until you send it again.</p>
          <ButtonLink to={`/app/quotes/${quote.data.id}`} className="mt-4">
            Open quote
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const initial: FormState = quote.data ? fromQuote(quote.data) : blank(defaultVat, params.get("contactId"), params.get("dealId"));
  return <QuoteForm key={quote.data?.updatedAt ?? "new"} quote={quote.data} initial={initial} defaultVat={defaultVat} />;
}

function blank(vat: number, contactId: string | null, dealId: string | null): FormState {
  const issueDate = todayDate(config.timezone);
  return { contactId: contactId || null, dealId: contactId && dealId ? dealId : null, issueDate, validUntil: addDays(issueDate, QUOTE_VALIDITY_DAYS), notes: "", terms: "", lines: [emptyLine(vat)] };
}

function fromQuote(quote: QuoteDetail): FormState {
  return {
    contactId: quote.contactId,
    dealId: quote.dealId,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    notes: quote.notes,
    terms: quote.terms,
    lines: quote.lines.map(({ productId, description, quantity, unit, unitPriceCents, vatRateBps, discountBps }) => ({ productId, description, quantity, unit, unitPriceCents, vatRateBps, discountBps })),
  };
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-muted hover:text-ink">
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}

function QuoteForm({ quote, initial, defaultVat }: { quote?: QuoteDetail; initial: FormState; defaultVat: number }) {
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveQuote(quote?.id);
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const issues = save.error instanceof ApiError ? save.error.issues : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { contactId: form.contactId ?? "", dealId: form.dealId, issueDate: form.issueDate, validUntil: form.validUntil, notes: form.notes, terms: form.terms, lines: form.lines },
      {
        onSuccess: (saved) => {
          toast(quote ? "Quote saved" : `Quote ${saved.number} created`);
          navigate(`/app/quotes/${saved.id}`);
        },
      },
    );
  };

  const cancelTo = quote ? `/app/quotes/${quote.id}` : "/app/quotes";
  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        back={<BackLink to={cancelTo} label={quote ? `Quote ${quote.number}` : "Quotes"} />}
        title={quote ? `Edit quote ${quote.number}` : "New quote"}
        actions={
          <>
            <ButtonLink to={cancelTo} variant="ghost">
              Cancel
            </ButtonLink>
            <Button type="submit" variant="primary" loading={save.isPending}>
              Save draft
            </Button>
          </>
        }
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader title="Customer" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Contact" error={issues.contactId}>
              {(props) => <ContactPicker id={props.id} invalid={props["aria-invalid"]} value={form.contactId} onChange={(contact) => setForm((current) => ({ ...current, contactId: contact?.id ?? null, dealId: null }))} />}
            </Field>
            {form.contactId ? <DealSelect contactId={form.contactId} value={form.dealId} onChange={(dealId) => set("dealId", dealId)} error={issues.dealId} /> : <div className="hidden md:block" />}
            <Field label="Issue date" error={issues.issueDate}>
              {(props) => <Input {...props} type="date" required value={form.issueDate} onChange={(event) => set("issueDate", event.target.value)} />}
            </Field>
            <Field label="Valid until" error={issues.validUntil}>
              {(props) => <Input {...props} type="date" required min={form.issueDate} value={form.validUntil} onChange={(event) => set("validUntil", event.target.value)} />}
            </Field>
          </div>
        </Card>

        <section aria-labelledby="quote-lines" className="grid gap-3">
          <h2 id="quote-lines" className="text-base font-semibold">
            Lines
          </h2>
          <LineItemsEditor lines={form.lines} onChange={(lines) => set("lines", lines)} defaultVatRateBps={defaultVat} errors={issues} />
        </section>

        <Card>
          <CardHeader title="Notes and terms" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Notes" error={issues.notes}>
              {(props) => <Textarea {...props} rows={4} placeholder="Delivery time, what is included" value={form.notes} onChange={(event) => set("notes", event.target.value)} />}
            </Field>
            <Field label="Terms" error={issues.terms}>
              {(props) => <Textarea {...props} rows={4} placeholder="Payment and delivery conditions" value={form.terms} onChange={(event) => set("terms", event.target.value)} />}
            </Field>
          </div>
        </Card>

        <FormError error={save.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink to={cancelTo} variant="ghost">
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

function DealSelect({ contactId, value, onChange, error }: { contactId: string; value: string | null; onChange: (dealId: string | null) => void; error?: string }) {
  const deals = useDeals({ contactId });
  const items = deals.data ?? [];
  return (
    <Field label="Deal (optional)" error={error}>
      {(props) => (
        <Select {...props} value={value ?? ""} disabled={deals.isLoading} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">{deals.data && items.length === 0 ? "This contact has no deals" : "No deal"}</option>
          {items.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.title} ({deal.stageLabel})
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

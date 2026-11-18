import { ArrowLeft, Ban, Banknote, Copy, Pencil, Printer, Send, Stamp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { config } from "../../../../sistemele.config";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { useCan } from "@/app/lib/session";
import { Button, ButtonLink, Card, CardHeader, ConfirmDialog, Dialog, ErrorState, Field, FormError, IconButton, Input, MoneyInput, PageHeader, Select, Spinner, Textarea, useToast } from "@/app/ui";
import { todayDate } from "@/shared/dates";
import type { PartySnapshot } from "@/shared/lines";
import { PAYMENT_METHODS, type InvoiceActionResult, type InvoiceDetail, type PaymentMethod } from "../shared/schema";
import { useBusiness, useDeleteInvoice, useDeletePayment, useInvoice, useIssueInvoice, useRecordPayment, useSendInvoice, useVoidInvoice } from "./api";
import { InvoiceStatusBadge } from "./StatusBadge";
import { DocumentLogo } from "@/app/components/DocumentLogo";

type DialogName = "issue" | "payment" | "void" | "delete" | null;

export default function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = useCan("admin");
  const invoice = useInvoice(id);
  const send = useSendInvoice(id);
  const remove = useDeleteInvoice();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  if (invoice.isLoading) return <Spinner />;
  if (invoice.error || !invoice.data) return <ErrorState error={invoice.error} retry={() => invoice.refetch()} />;
  const data = invoice.data;
  const isDraft = data.status === "draft";
  const canPay = data.status === "issued";
  const canSend = data.status === "issued" || data.status === "paid";
  const canVoid = isAdmin && canSend;

  const afterSend = (result: InvoiceActionResult) => {
    if (result.publicUrl) setPublicUrl(result.publicUrl);
    if (result.emailStatus === "failed") toast("The email could not be sent. Check Settings → Email and try again.", "danger");
    else if (result.emailStatus === "logged") toast("Email logged, not sent: email delivery is not set up yet.");
    else if (result.emailStatus) toast(`Invoice emailed to ${result.invoice.contact.email}.`);
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast("Link copied.");
    } catch {
      toast("Copy failed. Select the link and copy it.", "danger");
    }
  };

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          back={
            <Link to="/app/invoices" className="inline-flex items-center gap-1 text-muted hover:text-ink">
              <ArrowLeft className="size-4" /> Invoices
            </Link>
          }
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {data.number ?? "Draft invoice"} <InvoiceStatusBadge invoice={data} />
            </span>
          }
          description={
            <Link to={`/app/crm/contacts/${data.contactId}`} className="hover:underline">
              {data.contact.name}
            </Link>
          }
          actions={
            <>
              {isDraft ? (
                <>
                  <IconButton label="Delete draft" onClick={() => setDialog("delete")}>
                    <Trash2 />
                  </IconButton>
                  <ButtonLink to={`/app/invoices/${data.id}/edit`} icon={<Pencil />}>
                    Edit
                  </ButtonLink>
                  <Button variant="primary" icon={<Stamp />} onClick={() => setDialog("issue")}>
                    Issue
                  </Button>
                </>
              ) : null}
              {canVoid ? (
                <Button variant="ghost" icon={<Ban />} onClick={() => setDialog("void")}>
                  Void
                </Button>
              ) : null}
              {!isDraft ? (
                <Button variant="ghost" icon={<Printer />} onClick={() => window.print()}>
                  Print
                </Button>
              ) : null}
              {canSend ? (
                <Button icon={<Send />} loading={send.isPending} onClick={() => send.mutate(undefined, { onSuccess: afterSend, onError: (error) => toast(error.message, "danger") })}>
                  {data.hasPublicLink ? "Send again" : "Send"}
                </Button>
              ) : null}
              {canPay ? (
                <Button variant="primary" icon={<Banknote />} onClick={() => setDialog("payment")}>
                  Record payment
                </Button>
              ) : null}
            </>
          }
        />
        {publicUrl ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface px-4 py-3">
            <label htmlFor="invoice-link" className="text-sm font-medium">
              Customer link
            </label>
            <Input id="invoice-link" readOnly value={publicUrl} className="min-w-0 flex-1 font-mono text-xs" onFocus={(event) => event.target.select()} />
            <Button size="sm" icon={<Copy />} onClick={copyLink}>
              Copy link
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument invoice={data} />
        <div className="grid content-start gap-6 print:hidden">
          <Summary invoice={data} />
          {data.status !== "draft" ? <Payments invoice={data} isAdmin={isAdmin} /> : null}
        </div>
      </div>

      <IssueDialog invoice={data} open={dialog === "issue"} onClose={() => setDialog(null)} onIssued={afterSend} />
      {canPay ? <PaymentDialog key={`${data.updatedAt}-${dialog}`} invoice={data} open={dialog === "payment"} onClose={() => setDialog(null)} /> : null}
      <VoidDialog invoice={data} open={dialog === "void"} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this draft?"
        message="The draft and its lines are removed. Drafts have no number, so numbering is not affected."
        confirmLabel="Delete draft"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(data.id, { onSuccess: () => (toast("Draft deleted."), navigate("/app/invoices")), onError: (error) => toast(error.message, "danger") })}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function Party({ label, party }: { label: string; party: PartySnapshot }) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</h3>
      <p className="mt-1 font-medium">{party.name}</p>
      <div className="text-sm text-ink-soft">
        {party.companyCode ? <p>Company code {party.companyCode}</p> : null}
        {party.vatCode ? <p>VAT {party.vatCode}</p> : null}
        {party.address ? <p className="whitespace-pre-line">{party.address}</p> : null}
        {party.email ? <p className="break-words">{party.email}</p> : null}
        {party.phone ? <p>{party.phone}</p> : null}
      </div>
    </div>
  );
}

/** The invoice as the customer sees it. Prints on its own (the rest of the page is print:hidden). */
function InvoiceDocument({ invoice }: { invoice: InvoiceDetail }) {
  const format = useFormat();
  const money = (cents: number) => format.money(cents, invoice.currency);
  return (
    <Card className="min-w-0 p-5 sm:p-8 print:border-0 print:p-0">
      <DocumentLogo />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">{invoice.number ? `Invoice ${invoice.number}` : "Draft invoice"}</h2>
        {invoice.status === "draft" ? <p className="text-sm text-muted">Preview. The number is assigned when you issue it.</p> : null}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Party label="From" party={invoice.seller} />
        <Party label="To" party={invoice.buyer} />
        <dl className="grid content-start gap-1 text-sm">
          <div>
            <dt className="inline text-muted">Issue date: </dt>
            <dd className="inline">{invoice.issueDate ? format.date(invoice.issueDate) : "On issue"}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Due date: </dt>
            <dd className="inline">{invoice.dueDate ? format.date(invoice.dueDate) : "Set on issue"}</dd>
          </div>
          {invoice.quoteNumber ? (
            <div>
              <dt className="inline text-muted">Quote: </dt>
              <dd className="inline">{invoice.quoteNumber}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <th scope="col" className="py-2 pr-3">
                Description
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Unit price
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                VAT
              </th>
              <th scope="col" className="py-2 pl-3 text-right">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-line align-top">
                <td className="py-2.5 pr-3">
                  {line.description}
                  {line.discountBps ? <span className="text-muted"> (−{format.vat(line.discountBps)})</span> : null}
                </td>
                <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">
                  {format.number(line.quantity)} {line.unit}
                </td>
                <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">{money(line.unitPriceCents)}</td>
                <td className="tabular px-3 py-2.5 text-right">{format.vat(line.vatRateBps)}</td>
                <td className="tabular py-2.5 pl-3 text-right whitespace-nowrap">{money(line.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="tabular mt-4 ml-auto grid w-full max-w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">Net</dt>
        <dd className="text-right">{money(invoice.subtotalCents)}</dd>
        {invoice.vatGroups.map((group) => (
          <div key={group.rateBps} className="contents">
            <dt className="text-muted">VAT {format.vat(group.rateBps)}</dt>
            <dd className="text-right">{money(group.vatCents)}</dd>
          </div>
        ))}
        <dt className="border-t border-line pt-1 font-semibold">Total</dt>
        <dd className="border-t border-line pt-1 text-right font-semibold">{money(invoice.totalCents)}</dd>
        {invoice.status !== "draft" ? (
          <>
            <dt className="text-muted">Paid</dt>
            <dd className="text-right">{money(invoice.paidCents)}</dd>
            <dt className="font-semibold">Amount due</dt>
            <dd className="text-right font-semibold">{money(invoice.amountDueCents)}</dd>
          </>
        ) : null}
      </dl>

      {invoice.notes ? <p className="mt-6 whitespace-pre-line text-ink-soft">{invoice.notes}</p> : null}
      {invoice.status === "issued" && invoice.seller.bank.iban ? (
        <div className="mt-6 rounded-control border border-line p-4 text-sm">
          <p className="font-medium">Payment by bank transfer</p>
          <p className="mt-1 text-ink-soft">
            {invoice.seller.bank.name ? `${invoice.seller.bank.name} · ` : ""}IBAN {invoice.seller.bank.iban} · Reference {invoice.number}
          </p>
        </div>
      ) : null}
      {invoice.seller.footer ? <p className="mt-6 text-sm whitespace-pre-line text-muted">{invoice.seller.footer}</p> : null}
    </Card>
  );
}

function Summary({ invoice }: { invoice: InvoiceDetail }) {
  const format = useFormat();
  const money = (cents: number) => format.money(cents, invoice.currency);
  const rows: Array<[string, string]> = [
    ["Total", money(invoice.totalCents)],
    ...(invoice.status === "draft" ? [] : ([["Paid", money(invoice.paidCents)], ["Amount due", money(invoice.amountDueCents)]] as Array<[string, string]>)),
  ];
  return (
    <Card>
      <CardHeader title="Summary" />
      <div className="grid gap-3 p-5">
        <dl className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {invoice.overdue ? (
          <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {invoice.daysOverdue} day{invoice.daysOverdue === 1 ? "" : "s"} past the due date.
          </p>
        ) : null}
        {invoice.status === "paid" && invoice.paidAt ? <p className="text-sm text-success">Paid in full {format.date(invoice.paidAt)}.</p> : null}
        {invoice.status === "void" ? (
          <div className="rounded-control bg-sunken px-3 py-2 text-sm">
            <p className="font-medium">Voided {format.date(invoice.voidedAt)}</p>
            <p className="mt-0.5 text-ink-soft">{invoice.voidReason}</p>
          </div>
        ) : null}
        {invoice.status !== "draft" && !invoice.hasPublicLink && invoice.status !== "void" ? <p className="text-sm text-muted">Not sent to the customer yet.</p> : null}
      </div>
    </Card>
  );
}

function Payments({ invoice, isAdmin }: { invoice: InvoiceDetail; isAdmin: boolean }) {
  const format = useFormat();
  const toast = useToast();
  const remove = useDeletePayment(invoice.id);
  const [removing, setRemoving] = useState<string | null>(null);
  const methodLabel = (method: PaymentMethod) => PAYMENT_METHODS.find((item) => item.id === method)?.label ?? method;
  return (
    <Card>
      <CardHeader title="Payments" />
      <ul className="divide-y divide-line">
        {invoice.payments.map((payment) => (
          <li key={payment.id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="tabular font-medium">{format.money(payment.amountCents, invoice.currency)}</p>
              <p className="truncate text-xs text-muted">
                {format.date(payment.paidOn)} · {methodLabel(payment.method)}
                {payment.reference ? ` · ${payment.reference}` : ""}
              </p>
            </div>
            {isAdmin && invoice.status !== "void" ? (
              <IconButton label={`Delete payment of ${format.money(payment.amountCents, invoice.currency)}`} onClick={() => setRemoving(payment.id)}>
                <Trash2 />
              </IconButton>
            ) : null}
          </li>
        ))}
        {invoice.payments.length === 0 ? <li className="px-5 py-4 text-sm text-muted">No payments yet.</li> : null}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title="Delete this payment?"
        message="Use this to correct a payment recorded by mistake. The amount due goes back up."
        confirmLabel="Delete payment"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing, { onSuccess: () => (setRemoving(null), toast("Payment deleted.")), onError: (error) => toast(error.message, "danger") })}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
}

function IssueDialog({ invoice, open, onClose, onIssued }: { invoice: InvoiceDetail; open: boolean; onClose: () => void; onIssued: (result: InvoiceActionResult) => void }) {
  const format = useFormat();
  const business = useBusiness();
  const issue = useIssueInvoice(invoice.id);
  const hasEmail = Boolean(invoice.contact.email);
  const [sendEmail, setSendEmail] = useState(hasEmail);
  const terms = business.data?.business.paymentTermsDays;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Issue this invoice?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={issue.isPending} onClick={() => issue.mutate({ send: sendEmail && hasEmail }, { onSuccess: (result) => (onClose(), onIssued(result)) })}>
            {sendEmail && hasEmail ? "Issue and email" : "Issue invoice"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-ink-soft">Issuing assigns the next invoice number and locks the invoice. To correct it later, void it and create a new one.</p>
        <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Customer</dt>
          <dd>{invoice.contact.name}</dd>
          <dt className="text-muted">Total</dt>
          <dd className="font-medium">{format.money(invoice.totalCents, invoice.currency)}</dd>
          <dt className="text-muted">Due</dt>
          <dd>{invoice.dueDate ? format.date(invoice.dueDate) : terms !== undefined ? `${terms} days after today` : "Payment terms from Settings"}</dd>
        </dl>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={sendEmail && hasEmail} disabled={!hasEmail} onChange={(event) => setSendEmail(event.target.checked)} />
          <span>
            Email it to the customer
            <span className="block text-muted">{hasEmail ? invoice.contact.email : "The contact has no email address."}</span>
          </span>
        </label>
        <FormError error={issue.error} />
      </div>
    </Dialog>
  );
}

function PaymentDialog({ invoice, open, onClose }: { invoice: InvoiceDetail; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const record = useRecordPayment(invoice.id);
  const [amountCents, setAmountCents] = useState<number | null>(invoice.amountDueCents);
  const [paidOn, setPaidOn] = useState(todayDate(config.timezone));
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={record.isPending}
            onClick={() =>
              record.mutate(
                { amountCents: amountCents ?? 0, paidOn, method, reference },
                { onSuccess: (updated) => (onClose(), toast(updated.status === "paid" ? `${updated.number} is paid in full.` : "Payment recorded.")) },
              )
            }
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" error={fieldError(record.error, "amountCents")}>
          {(props) => <MoneyInput {...props} value={amountCents} onValueChange={setAmountCents} />}
        </Field>
        <Field label="Received on" error={fieldError(record.error, "paidOn")}>
          {(props) => <Input {...props} type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />}
        </Field>
        <Field label="Method">
          {(props) => (
            <Select {...props} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reference" error={fieldError(record.error, "reference")}>
          {(props) => <Input {...props} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank statement line" />}
        </Field>
        <div className="sm:col-span-2">
          <FormError error={record.error} />
        </div>
      </div>
    </Dialog>
  );
}

function VoidDialog({ invoice, open, onClose }: { invoice: InvoiceDetail; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const voidInvoice = useVoidInvoice(invoice.id);
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Void ${invoice.number}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={voidInvoice.isPending} disabled={!reason.trim()} onClick={() => voidInvoice.mutate(reason, { onSuccess: () => (onClose(), setReason(""), toast(`${invoice.number} is void.`)) })}>
            Void invoice
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-ink-soft">The number stays used and payments stay on record. The customer link shows the invoice as void. This cannot be undone.</p>
        <Field label="Reason" error={fieldError(voidInvoice.error, "reason")}>
          {(props) => <Textarea {...props} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Wrong customer details" />}
        </Field>
        <FormError error={voidInvoice.error} />
      </div>
    </Dialog>
  );
}

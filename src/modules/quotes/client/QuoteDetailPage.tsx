import { ArrowLeft, Check, Copy, CopyPlus, FilePlus2, Pencil, Printer, ReceiptText, RotateCcw, Send, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { formatMoney } from "@/shared/money";
import { errorMessage } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Button, ButtonLink, Card, CardHeader, ConfirmDialog, Dialog, ErrorState, Field, FormError, Input, PageHeader, Spinner, Textarea, useToast } from "@/app/ui";
import { clientModules } from "@/modules/client";
import type { QuoteDetail, QuoteSendResult } from "../shared/schema";
import { useCreateInvoiceFromQuote, useDeleteQuote, useDuplicateQuote, useMarkQuote, useQuote, useReviseQuote, useSendQuote } from "./api";
import { QuoteDocument } from "./QuoteDocument";
import { QuoteStatusBadge } from "./parts";

/** Print only the quote document, not the dashboard around it. */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-print-root], [data-print-root] * { visibility: visible !important; }
  [data-print-root] { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; padding: 0 !important; }
}`;

export default function QuoteDetailPage() {
  const { id = "" } = useParams();
  const quote = useQuote(id);
  if (quote.isLoading) return <Spinner />;
  if (quote.error || !quote.data) return <ErrorState error={quote.error} retry={() => quote.refetch()} />;
  return <QuoteView quote={quote.data} />;
}

type DialogName = "send" | "revise" | "accepted" | "declined" | "delete" | null;

function QuoteView({ quote }: { quote: QuoteDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const format = useFormat();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [sent, setSent] = useState<Pick<QuoteSendResult, "publicUrl" | "emailStatus"> | null>(null);
  const revise = useReviseQuote(quote.id);
  const mark = useMarkQuote(quote.id);
  const remove = useDeleteQuote();
  const duplicate = useDuplicateQuote(quote.id);
  const createInvoice = useCreateInvoiceFromQuote(quote.id);
  const invoicesEnabled = clientModules.some((module) => module.id === "invoices");
  const close = () => setDialog(null);
  const { status } = quote;
  const open = status === "sent" || status === "expired";

  const duplicateButton = (
    <Button variant="outline"
      icon={<CopyPlus />}
      loading={duplicate.isPending}
      onClick={() =>
        duplicate.mutate(undefined, {
          onSuccess: (copy) => {
            toast(`Copied to draft ${copy.number}`);
            navigate(`/app/quotes/${copy.id}/edit`);
          },
          onError: (error) => toast(errorMessage(error), "danger"),
        })
      }
    >
      Duplicate
    </Button>
  );

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <PageHeader
        back={
          <Link to="/app/quotes" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Quotes
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Quote {quote.number} <QuoteStatusBadge status={status} />
          </span>
        }
        description={
          <>
            <Link to={`/app/crm/contacts/${quote.contactId}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {quote.contactName}
            </Link>{" "}
            · <span className="tabular">{formatMoney(quote.totalCents, quote.currency, format.locale)}</span>
          </>
        }
        actions={
          <>
            {status === "draft" ? (
              <>
                <ButtonLink variant="outline" to={`/app/quotes/${quote.id}/edit`} icon={<Pencil />}>
                  Edit
                </ButtonLink>
                <Button variant="default" icon={<Send />} onClick={() => setDialog("send")}>
                  Send
                </Button>
              </>
            ) : null}
            {status === "sent" ? (
              <Button variant="outline" icon={<Send />} onClick={() => setDialog("send")}>
                Send again
              </Button>
            ) : null}
            {open ? (
              <Button variant={status === "expired" ? "default" : "outline"} icon={<RotateCcw />} onClick={() => setDialog("revise")}>
                Revise
              </Button>
            ) : null}
            {status === "accepted" && invoicesEnabled ? (
              quote.invoiceId ? (
                <ButtonLink to={`/app/invoices/${quote.invoiceId}`} variant="default" icon={<ReceiptText />}>
                  Open invoice
                </ButtonLink>
              ) : (
                <Button
                  variant="default"
                  icon={<FilePlus2 />}
                  loading={createInvoice.isPending}
                  onClick={() =>
                    createInvoice.mutate(undefined, {
                      onSuccess: (invoice) => navigate(`/app/invoices/${invoice.id}`),
                      onError: (error) => toast(errorMessage(error), "danger"),
                    })
                  }
                >
                  Create invoice
                </Button>
              )
            ) : null}
            {duplicateButton}
            <Button variant="ghost" icon={<Printer />} onClick={() => window.print()}>
              Print
            </Button>
            {status === "draft" ? (
              <Button variant="ghost" icon={<Trash2 />} onClick={() => setDialog("delete")}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {sent && status === "sent" ? <CustomerLink url={sent.publicUrl} emailStatus={sent.emailStatus} email={quote.contact.email} onDismiss={() => setSent(null)} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <QuoteDocument quote={quote} />
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Status" />
            <dl className="grid gap-3 px-5 py-4 text-sm">
              <Fact label="Created" value={format.dateTime(quote.createdAt)} />
              {quote.sentAt ? <Fact label="Sent" value={format.dateTime(quote.sentAt)} /> : null}
              <Fact label="Valid until" value={<span className={status === "expired" ? "font-medium text-warning" : undefined}>{format.date(quote.validUntil)}</span>} />
              {quote.respondedAt ? <Fact label={status === "accepted" ? "Accepted" : "Declined"} value={format.dateTime(quote.respondedAt)} /> : null}
              {quote.dealId ? (
                <Fact
                  label="Deal"
                  value={
                    <Link to={`/app/crm/contacts/${quote.contactId}`} className="text-primary hover:underline">
                      {quote.dealTitle}
                    </Link>
                  }
                />
              ) : null}
              {quote.invoiceId && invoicesEnabled ? (
                <Fact
                  label="Invoice"
                  value={
                    <Link to={`/app/invoices/${quote.invoiceId}`} className="text-primary hover:underline">
                      Open invoice
                    </Link>
                  }
                />
              ) : null}
            </dl>
            {open ? (
              <div className="grid gap-2 border-t border-border px-5 py-4">
                <p className="text-sm text-foreground/80">Customer answered by phone or email?</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" icon={<Check />} onClick={() => setDialog("accepted")}>
                    Mark accepted
                  </Button>
                  <Button variant="outline" size="sm" icon={<X />} onClick={() => setDialog("declined")}>
                    Mark declined
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <SendDialog
        key={`${quote.id}:${quote.updatedAt}`}
        quote={quote}
        open={dialog === "send"}
        onClose={close}
        onSent={(result) => {
          setSent(result);
          close();
          toast(result.emailStatus === "sent" ? `Quote sent to ${quote.contact.email}` : "Quote marked sent. Share the customer link.", result.emailStatus === "failed" ? "danger" : "success");
        }}
      />
      <Dialog
        open={dialog === "revise"}
        onClose={close}
        title={`Revise quote ${quote.number}?`}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="default"
              loading={revise.isPending}
              onClick={() =>
                revise.mutate(undefined, {
                  onSuccess: () => {
                    close();
                    setSent(null);
                    navigate(`/app/quotes/${quote.id}/edit`);
                  },
                })
              }
            >
              Return to draft
            </Button>
          </>
        }
      >
        <p className="text-foreground/80">The quote goes back to draft and the customer link stops working. Edit it, then send it again.</p>
        <div className="mt-3">
          <FormError error={revise.error} />
        </div>
      </Dialog>
      <Dialog
        open={dialog === "accepted" || dialog === "declined"}
        onClose={close}
        title={dialog === "declined" ? "Mark as declined?" : "Mark as accepted?"}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant={dialog === "declined" ? "destructive" : "default"}
              loading={mark.isPending}
              onClick={() => {
                const answer = dialog === "declined" ? "declined" : "accepted";
                mark.mutate({ status: answer }, { onSuccess: () => (close(), setSent(null), toast(`Quote ${quote.number} marked ${answer}`)) });
              }}
            >
              {dialog === "declined" ? "Mark declined" : "Mark accepted"}
            </Button>
          </>
        }
      >
        <p className="text-foreground/80">
          {dialog === "declined"
            ? `Record that ${quote.contactName} declined. The quote locks and the customer link only shows the answer.`
            : `Record that ${quote.contactName} accepted ${formatMoney(quote.totalCents, quote.currency, format.locale)}. The quote locks${quote.dealId ? " and the deal moves to Won" : ""}.`}
        </p>
        <div className="mt-3">
          <FormError error={mark.error} />
        </div>
      </Dialog>
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete draft ${quote.number}?`}
        message="The draft and its lines are removed. This cannot be undone."
        confirmLabel="Delete draft"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(quote.id, {
            onSuccess: () => {
              toast(`Draft ${quote.number} deleted`);
              navigate("/app/quotes");
            },
            onError: (error) => (close(), toast(errorMessage(error), "danger")),
          })
        }
        onClose={close}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{value}</dd>
    </div>
  );
}

function CustomerLink({ url, emailStatus, email, onDismiss }: { url: string; emailStatus: QuoteSendResult["emailStatus"]; email: string; onDismiss: () => void }) {
  const toast = useToast();
  const lead =
    emailStatus === "sent"
      ? `Emailed to ${email}.`
      : emailStatus === "failed"
        ? `The email to ${email} failed. Send this link to the customer yourself.`
        : "Email delivery is not set up, so nothing was emailed. Send this link to the customer yourself.";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Select the link and copy it", "danger");
    }
  };
  return (
    <Card className="mb-6 border-primary/30 bg-primary/5 print:hidden" role="status">
      <div className="grid gap-3 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">Customer link</p>
            <p className="text-sm text-foreground/80">{lead} Copy it now: it is shown only once. Send again creates a new link and the old one stops working.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Hide
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={url} aria-label="Customer link" onFocus={(event) => event.currentTarget.select()} className="font-mono text-sm" />
          <Button variant="outline" icon={<Copy />} onClick={copy}>
            Copy link
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SendDialog({ quote, open, onClose, onSent }: { quote: QuoteDetail; open: boolean; onClose: () => void; onSent: (result: QuoteSendResult) => void }) {
  const send = useSendQuote(quote.id);
  const [message, setMessage] = useState("");
  const resend = quote.status === "sent";
  const email = quote.contact.email;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={resend ? `Send quote ${quote.number} again` : `Send quote ${quote.number}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" icon={<Send />} disabled={!email} loading={send.isPending} onClick={() => send.mutate({ message }, { onSuccess: (result) => (setMessage(""), onSent(result)) })}>
            {resend ? "Send new link" : "Send quote"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {email ? (
          <p>
            To <span className="font-medium">{quote.contactName}</span> &lt;{email}&gt;
          </p>
        ) : (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning" role="alert">
            {quote.contactName} has no email address.{" "}
            <Link to={`/app/crm/contacts/${quote.contactId}`} className="font-medium underline">
              Add one in CRM
            </Link>
            , then send.
          </p>
        )}
        {resend ? <p className="text-sm text-foreground/80">The customer gets a new link. The previous link stops working.</p> : null}
        <Field label="Message (optional)">{(props) => <Textarea {...props} rows={4} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Hello, here is our quote for ${quote.dealTitle ?? "your request"}.`} />}</Field>
        <FormError error={send.error} />
      </div>
    </Dialog>
  );
}

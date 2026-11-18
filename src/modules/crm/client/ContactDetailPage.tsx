import { ArrowLeft, Archive, CheckCircle2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Badge, Button, Card, CardHeader, ConfirmDialog, DetailList, Dialog, ErrorState, Field, FormError, Input, MoneyInput, PageHeader, Select, Spinner, Textarea } from "@/app/ui";
import { ACTIVITY_KINDS, DEAL_STAGES, type Activity } from "../shared/schema";
import { useAddActivity, useArchiveContact, useCompleteTask, useContact, useCreateDeal } from "./api";
import { ContactFormDialog } from "./ContactForm";

const stageTone = { lead: "neutral", qualified: "info", proposal: "warning", won: "success", lost: "danger" } as const;

export default function ContactDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const format = useFormat();
  const detail = useContact(id);
  const archive = useArchiveContact();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);

  if (detail.isLoading) return <Spinner />;
  if (detail.error || !detail.data) return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  const { contact, deals, activities } = detail.data;

  return (
    <div>
      <PageHeader
        back={
          <Link to="/app/crm/contacts" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Contacts
          </Link>
        }
        title={contact.name}
        description={[contact.kind === "company" ? "Company" : contact.companyName ? `Person at ${contact.companyName}` : "Person", contact.source === "website" ? "from the website" : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button icon={<Pencil />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" icon={<Archive />} onClick={() => setArchiving(true)}>
              Archive
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5">
              <DetailList
                items={[
                  { label: "Email", value: contact.email ? <a className="text-brand hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "" },
                  { label: "Phone", value: contact.phone ? <a className="text-brand hover:underline" href={`tel:${contact.phone.replace(/\s/gu, "")}`}>{contact.phone}</a> : "" },
                  { label: "Company code", value: contact.companyCode },
                  { label: "VAT code", value: contact.vatCode },
                  { label: "Address", value: [contact.address, [contact.postalCode, contact.city].filter(Boolean).join(" "), contact.country].filter(Boolean).join(", ") },
                  { label: "Website", value: contact.website },
                  { label: "Tags", value: contact.tags.length ? <span className="flex flex-wrap gap-1">{contact.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</span> : "" },
                  { label: "Created", value: format.date(contact.createdAt) },
                ]}
              />
              {contact.notes ? <p className="mt-4 border-t border-line pt-4 whitespace-pre-line text-ink-soft">{contact.notes}</p> : null}
            </div>
          </Card>
          <Timeline contactId={contact.id} activities={activities} />
        </div>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader
              title="Deals"
              actions={
                <Button size="sm" icon={<Plus />} onClick={() => setAddingDeal(true)}>
                  Deal
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {deals.map((deal) => (
                <li key={deal.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{deal.title}</p>
                    <p className="tabular text-sm text-muted">{format.money(deal.valueCents)}</p>
                  </div>
                  <Badge tone={stageTone[deal.stage]}>{DEAL_STAGES.find((s) => s.id === deal.stage)?.label}</Badge>
                </li>
              ))}
              {deals.length === 0 ? <li className="px-5 py-4 text-sm text-muted">No deals yet.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
      <ContactFormDialog key={contact.updatedAt} open={editing} onClose={() => setEditing(false)} contact={contact} />
      <NewDealDialog contactId={contact.id} open={addingDeal} onClose={() => setAddingDeal(false)} />
      <ConfirmDialog
        open={archiving}
        title={`Archive ${contact.name}?`}
        message="The contact disappears from lists and search. Its deals, quotes and invoices stay."
        confirmLabel="Archive contact"
        loading={archive.isPending}
        onConfirm={() => archive.mutate(contact.id, { onSuccess: () => navigate("/app/crm/contacts") })}
        onClose={() => setArchiving(false)}
      />
    </div>
  );
}

function Timeline({ contactId, activities }: { contactId: string; activities: Activity[] }) {
  const format = useFormat();
  const add = useAddActivity();
  const complete = useCompleteTask();
  const [kind, setKind] = useState<(typeof ACTIVITY_KINDS)[number]>("note");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");

  return (
    <Card>
      <CardHeader title="Timeline" />
      <form
        className="grid gap-3 border-b border-line p-5"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ contactId, kind, body, dueAt: kind === "task" && dueAt ? dueAt : null }, { onSuccess: () => (setBody(""), setDueAt("")) });
        }}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activity type">
          {ACTIVITY_KINDS.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={kind === value} onClick={() => setKind(value)} className={`h-8 rounded-full border px-3 text-sm capitalize ${kind === value ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft hover:border-line-strong"}`}>
              {value}
            </button>
          ))}
        </div>
        <Textarea aria-label="Activity text" placeholder={kind === "task" ? "What needs doing?" : "What happened?"} value={body} onChange={(event) => setBody(event.target.value)} rows={3} aria-invalid={fieldError(add.error, "body") ? true : undefined} />
        <div className="flex flex-wrap items-end gap-3">
          {kind === "task" ? (
            <Field label="Due">
              {(props) => <Input {...props} type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-44" />}
            </Field>
          ) : null}
          <Button type="submit" variant="primary" loading={add.isPending} disabled={!body.trim()}>
            Add {kind}
          </Button>
        </div>
        <FormError error={add.error} />
      </form>
      <ol className="divide-y divide-line">
        {activities.map((activity) => (
          <li key={activity.id} className="flex gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={activity.kind === "system" ? "brand" : activity.kind === "task" ? "warning" : "neutral"}>{activity.kind}</Badge>
                <span>{activity.authorName ?? (activity.kind === "system" ? "System" : "Website")}</span>
                <span>·</span>
                <time dateTime={activity.createdAt}>{format.dateTime(activity.createdAt)}</time>
                {activity.dueAt ? <span>· due {format.date(activity.dueAt)}</span> : null}
              </div>
              <p className={`mt-1 whitespace-pre-line ${activity.doneAt ? "text-muted line-through" : ""}`}>{activity.body}</p>
            </div>
            {activity.kind === "task" && !activity.doneAt ? (
              <Button size="sm" variant="ghost" icon={<CheckCircle2 />} onClick={() => complete.mutate(activity.id)}>
                Done
              </Button>
            ) : null}
          </li>
        ))}
        {activities.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Nothing here yet. Notes, tasks, quotes and invoices appear on this timeline.</li> : null}
      </ol>
    </Card>
  );
}

export function NewDealDialog({ contactId, open, onClose }: { contactId: string; open: boolean; onClose: () => void }) {
  const create = useCreateDeal();
  const [title, setTitle] = useState("");
  const [valueCents, setValueCents] = useState<number | null>(null);
  const [stage, setStage] = useState("lead");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New deal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate({ contactId, title, valueCents: valueCents ?? 0, stage: stage as never }, { onSuccess: () => (onClose(), setTitle(""), setValueCents(null)) })}>
            Create deal
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Title" error={fieldError(create.error, "title")}>
          {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="40 m² steel mesh" />}
        </Field>
        <Field label="Expected value (net)" error={fieldError(create.error, "valueCents")}>
          {(props) => <MoneyInput {...props} value={valueCents} onValueChange={setValueCents} />}
        </Field>
        <Field label="Stage">
          {(props) => (
            <Select {...props} value={stage} onChange={(event) => setStage(event.target.value)}>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <FormError error={create.error} />
      </div>
    </Dialog>
  );
}

import { ArrowLeft, Archive, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Badge, Button, Card, CardHeader, ConfirmDialog, DetailList, Dialog, ErrorState, Field, FormError, Input, MoneyInput, PageHeader, Select, Spinner } from "@/app/ui";
import { useArchiveContact, useContact, useCreateDeal, useStages } from "./api";
import { ContactFormDialog } from "./ContactForm";
import { LeadStatusBadge, stageTone, Timeline } from "./parts";

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
  const { contact, deals, activities, leads } = detail.data;

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
          <Timeline target={{ contactId: contact.id }} activities={activities} emptyText="Nothing here yet. Notes, tasks, quotes and invoices appear on this timeline." />
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
                  <Badge tone={stageTone(deal.stageKind)}>{deal.stageLabel}</Badge>
                </li>
              ))}
              {deals.length === 0 ? <li className="px-5 py-4 text-sm text-muted">No deals yet.</li> : null}
            </ul>
          </Card>
          {leads.length ? (
            <Card>
              <CardHeader title="Leads" />
              <ul className="divide-y divide-line">
                {leads.map((lead) => (
                  <li key={lead.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <Link to={`/app/crm/leads/${lead.id}`} className="min-w-0 truncate font-medium hover:text-brand hover:underline">
                      {lead.name}
                    </Link>
                    <LeadStatusBadge status={lead.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
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

export function NewDealDialog({ contactId, open, onClose }: { contactId: string; open: boolean; onClose: () => void }) {
  const create = useCreateDeal();
  const stages = useStages();
  const [title, setTitle] = useState("");
  const [valueCents, setValueCents] = useState<number | null>(null);
  const [stage, setStage] = useState("");
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
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate({ contactId, title, valueCents: valueCents ?? 0, stage: stage || undefined }, { onSuccess: () => (onClose(), setTitle(""), setValueCents(null)) })}>
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
            <Select {...props} value={stage || (stages.data?.find((s) => s.kind === "open")?.id ?? "")} onChange={(event) => setStage(event.target.value)}>
              {(stages.data ?? []).map((s) => (
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

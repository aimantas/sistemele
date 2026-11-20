import { ArrowLeft, ArrowRightLeft, Pencil, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Button, Card, CardHeader, CheckboxField, DetailList, Dialog, ErrorState, Field, FormError, Input, MoneyInput, PageHeader, Select, Spinner, Textarea } from "@/app/ui";
import { OPEN_LEAD_STATUSES, type Lead, type LeadDetail, type LeadStatus } from "../shared/schema";
import { useConvertLead, useLead, useSaveLead, useStages } from "./api";
import { LeadFormDialog } from "./LeadForm";
import { isDue, LeadStatusBadge, OwnerSelect, sourceLabel, Timeline } from "./parts";

const WORK_STEPS: Array<{ id: Exclude<LeadStatus, "disqualified" | "converted">; label: string }> = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
];

export default function LeadDetailPage() {
  const { id = "" } = useParams();
  const detail = useLead(id);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [disqualifying, setDisqualifying] = useState(false);
  const save = useSaveLead(id);

  if (detail.isLoading) return <Spinner />;
  if (detail.error || !detail.data) return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  const { lead, activities } = detail.data;
  const isOpen = OPEN_LEAD_STATUSES.includes(lead.status);

  return (
    <div>
      <PageHeader
        back={
          <Link to="/app/crm/leads" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Leads
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {lead.name} <LeadStatusBadge status={lead.status} />
          </span>
        }
        description={[lead.company, sourceLabel(lead.source)].filter(Boolean).join(" · ")}
        actions={
          isOpen ? (
            <>
              <Button variant="outline" icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="ghost" icon={<XCircle />} onClick={() => setDisqualifying(true)}>
                Disqualify
              </Button>
              <Button variant="default" icon={<ArrowRightLeft />} onClick={() => setConverting(true)}>
                Convert
              </Button>
            </>
          ) : lead.status === "disqualified" ? (
            <Button variant="outline" icon={<RotateCcw />} loading={save.isPending} onClick={() => save.mutate({ status: "new" })}>
              Reopen
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The work card comes first on phones; on desktop it sits in the right column. */}
        <div className="grid content-start gap-6 lg:col-start-2 lg:row-start-1">{isOpen ? <WorkCard lead={lead} /> : <OutcomeCard detail={detail.data} />}</div>
        <div className="grid content-start gap-6 lg:col-start-1 lg:row-start-1">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5">
              <DetailList
                items={[
                  { label: "Email", value: lead.email ? <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : "" },
                  { label: "Phone", value: lead.phone ? <a className="text-primary hover:underline" href={`tel:${lead.phone.replace(/\s/gu, "")}`}>{lead.phone}</a> : "" },
                  { label: "Company", value: lead.company },
                  { label: "Created", value: <CreatedAt value={lead.createdAt} /> },
                ]}
              />
              {lead.message ? <p className="mt-4 border-t border-border pt-4 whitespace-pre-line text-foreground/80">{lead.message}</p> : null}
            </div>
          </Card>
          <Timeline target={{ leadId: lead.id }} activities={activities} emptyText="Log calls, emails and meetings here. Logging one marks a new lead contacted." />
        </div>
      </div>
      {isOpen ? (
        <>
          <LeadFormDialog key={lead.updatedAt} open={editing} onClose={() => setEditing(false)} lead={lead} />
          <ConvertDialog key={`convert-${lead.updatedAt}`} detail={detail.data} open={converting} onClose={() => setConverting(false)} />
          <DisqualifyDialog lead={lead} open={disqualifying} onClose={() => setDisqualifying(false)} />
        </>
      ) : null}
    </div>
  );
}

function CreatedAt({ value }: { value: string }) {
  return <time dateTime={value}>{useFormat().dateTime(value)}</time>;
}

/** Status steps, owner, follow-up date and estimate — each saves on change. */
function WorkCard({ lead }: { lead: Lead }) {
  const format = useFormat();
  const save = useSaveLead(lead.id);
  const [followUp, setFollowUp] = useState(lead.followUpOn ?? "");
  const [value, setValue] = useState<number | null>(lead.valueCents || null);
  return (
    <Card>
      <CardHeader title="Work this lead" />
      <div className="grid gap-4 p-5">
        <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 overflow-hidden rounded-md border border-border">
          {WORK_STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              role="radio"
              aria-checked={lead.status === step.id}
              disabled={save.isPending}
              onClick={() => lead.status !== step.id && save.mutate({ status: step.id })}
              className={`h-9 border-l border-border text-sm font-medium first:border-l-0 ${lead.status === step.id ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-background"}`}
            >
              {step.label}
            </button>
          ))}
        </div>
        <OwnerSelect value={lead.ownerId} onChange={(ownerId) => save.mutate({ ownerId })} error={fieldError(save.error, "ownerId")} />
        <Field label="Follow up on" error={fieldError(save.error, "followUpOn")} hint={isDue(lead.followUpOn) ? `Due since ${format.date(lead.followUpOn)}` : undefined}>
          {(props) => <Input {...props} type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} onBlur={() => followUp !== (lead.followUpOn ?? "") && save.mutate({ followUpOn: followUp || null })} />}
        </Field>
        <Field label="Estimated value (net)" error={fieldError(save.error, "valueCents")}>
          {(props) => <MoneyInput {...props} value={value} onValueChange={setValue} onBlur={() => (value ?? 0) !== lead.valueCents && save.mutate({ valueCents: value ?? 0 })} />}
        </Field>
        <FormError error={save.error && !fieldError(save.error, "ownerId") && !fieldError(save.error, "followUpOn") ? save.error : null} />
      </div>
    </Card>
  );
}

function OutcomeCard({ detail }: { detail: LeadDetail }) {
  const format = useFormat();
  const { lead } = detail;
  if (lead.status === "disqualified") {
    return (
      <Card>
        <CardHeader title="Disqualified" />
        <p className="px-5 py-4 whitespace-pre-line text-foreground/80">{lead.disqualifyReason}</p>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Converted" />
      <div className="p-5">
        <DetailList
          items={[
            { label: "Contact", value: lead.contactId ? <Link className="text-primary hover:underline" to={`/app/crm/contacts/${lead.contactId}`}>{lead.contactName}</Link> : "" },
            { label: "Deal", value: lead.dealId ? <Link className="text-primary hover:underline" to="/app/crm/pipeline">{lead.dealTitle}</Link> : "" },
            { label: "Converted", value: format.date(lead.convertedAt) },
            { label: "Owner", value: lead.ownerName ?? "" },
          ]}
        />
      </div>
    </Card>
  );
}

function ConvertDialog({ detail, open, onClose }: { detail: LeadDetail; open: boolean; onClose: () => void }) {
  const { lead, matchingContact } = detail;
  const navigate = useNavigate();
  const stages = useStages();
  const convert = useConvertLead(lead.id);
  const openStages = (stages.data ?? []).filter((stage) => stage.kind === "open");
  const [createDeal, setCreateDeal] = useState(true);
  const [title, setTitle] = useState(lead.company || lead.name);
  const [valueCents, setValueCents] = useState<number | null>(lead.valueCents || null);
  const [stage, setStage] = useState("");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Convert ${lead.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            loading={convert.isPending}
            onClick={() =>
              convert.mutate(
                { createDeal, dealTitle: title, valueCents: valueCents ?? 0, stage: stage || undefined },
                { onSuccess: (result) => (onClose(), navigate(`/app/crm/contacts/${result.contact.id}`)) },
              )
            }
          >
            Convert lead
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-foreground/80">
          {matchingContact ? (
            <>
              Adds to the existing contact <strong className="text-foreground">{matchingContact.name}</strong> (same email).
            </>
          ) : (
            <>
              Creates the contact <strong className="text-foreground">{lead.company || lead.name}</strong>.
            </>
          )}{" "}
          The timeline moves with it.
        </p>
        <CheckboxField label="Open a deal" checked={createDeal} onChange={setCreateDeal} />
        {createDeal ? (
          <>
            <Field label="Deal title" error={fieldError(convert.error, "title")}>
              {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Value (net)" error={fieldError(convert.error, "valueCents")}>
                {(props) => <MoneyInput {...props} value={valueCents} onValueChange={setValueCents} />}
              </Field>
              <Field label="Stage" error={fieldError(convert.error, "stage")}>
                {(props) => (
                  <Select {...props} value={stage || openStages[0]?.id || ""} onChange={(event) => setStage(event.target.value)}>
                    {openStages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </>
        ) : null}
        <FormError error={convert.error} />
      </div>
    </Dialog>
  );
}

function DisqualifyDialog({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const save = useSaveLead(lead.id);
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Disqualify ${lead.name}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={save.isPending} onClick={() => save.mutate({ status: "disqualified", disqualifyReason: reason }, { onSuccess: () => (onClose(), setReason("")) })}>
            Disqualify lead
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <p className="text-foreground/80">The lead leaves the open list. Reopen it any time.</p>
        <Field label="Reason" error={fieldError(save.error, "disqualifyReason")}>
          {(props) => <Textarea {...props} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="No budget, wrong fit, spam …" />}
        </Field>
      </div>
    </Dialog>
  );
}

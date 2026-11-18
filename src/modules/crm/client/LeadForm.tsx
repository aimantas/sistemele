import { useState } from "react";
import { fieldError } from "@/app/lib/api";
import { useUser } from "@/app/lib/session";
import { Button, Dialog, Field, FormError, Input, MoneyInput, Select, Textarea } from "@/app/ui";
import { LEAD_SOURCES, type Lead, type LeadSource } from "../shared/schema";
import { useSaveLead } from "./api";
import { OwnerSelect } from "./parts";

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: LeadSource;
  valueCents: number | null;
  ownerId: string | null;
  followUpOn: string;
}

const fromLead = (lead: Lead | undefined, ownerId: string): LeadForm =>
  lead
    ? { name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, message: lead.message, source: lead.source, valueCents: lead.valueCents || null, ownerId: lead.ownerId, followUpOn: lead.followUpOn ?? "" }
    : { name: "", email: "", phone: "", company: "", message: "", source: "other", valueCents: null, ownerId, followUpOn: "" };

/** Create or edit a lead in a dialog. */
export function LeadFormDialog({ open, onClose, lead, onSaved }: { open: boolean; onClose: () => void; lead?: Lead; onSaved?: (lead: Lead) => void }) {
  const user = useUser();
  const [form, setForm] = useState<LeadForm>(() => fromLead(lead, user.id));
  const save = useSaveLead(lead?.id);
  const set = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => setForm({ ...form, [key]: value });
  const text = (key: "name" | "email" | "phone" | "company", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} error={fieldError(save.error, key)}>
      {(field) => <Input {...field} {...props} value={form[key]} onChange={(event) => set(key, event.target.value)} />}
    </Field>
  );

  const submit = () =>
    save.mutate(
      { ...form, valueCents: form.valueCents ?? 0, followUpOn: form.followUpOn || null },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onClose();
          if (!lead) setForm(fromLead(undefined, user.id));
        },
      },
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={lead ? `Edit ${lead.name}` : "New lead"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {lead ? "Save lead" : "Create lead"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Name", { required: true, autoFocus: true, autoComplete: "off" })}
        {text("company", "Company")}
        {text("email", "Email", { type: "email" })}
        {text("phone", "Phone", { type: "tel" })}
        <Field label="Source" error={fieldError(save.error, "source")}>
          {(field) => (
            <Select {...field} value={form.source} onChange={(event) => set("source", event.target.value as LeadSource)}>
              {LEAD_SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estimated value (net)" error={fieldError(save.error, "valueCents")}>
          {(field) => <MoneyInput {...field} value={form.valueCents} onValueChange={(cents) => set("valueCents", cents)} />}
        </Field>
        <OwnerSelect value={form.ownerId} onChange={(ownerId) => set("ownerId", ownerId)} error={fieldError(save.error, "ownerId")} />
        <Field label="Follow up on" error={fieldError(save.error, "followUpOn")}>
          {(field) => <Input {...field} type="date" value={form.followUpOn} onChange={(event) => set("followUpOn", event.target.value)} />}
        </Field>
        <Field label="What they need" className="sm:col-span-2" error={fieldError(save.error, "message")}>
          {(field) => <Textarea {...field} value={form.message} onChange={(event) => set("message", event.target.value)} />}
        </Field>
      </div>
      <div className="mt-4">
        <FormError error={save.error} />
      </div>
    </Dialog>
  );
}

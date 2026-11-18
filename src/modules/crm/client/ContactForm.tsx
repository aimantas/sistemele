import { useState } from "react";
import { fieldError } from "@/app/lib/api";
import { Button, Dialog, Field, FormError, Input, Select, Textarea } from "@/app/ui";
import type { Contact, ContactInput } from "../shared/schema";
import { useSaveContact } from "./api";

const empty: ContactInput = { kind: "company", name: "", email: "", phone: "", companyName: "", companyCode: "", vatCode: "", address: "", city: "", postalCode: "", country: "", website: "", tags: [], notes: "" };

/** Create or edit a contact in a dialog. */
export function ContactFormDialog({ open, onClose, contact, onSaved }: { open: boolean; onClose: () => void; contact?: Contact; onSaved?: (contact: Contact) => void }) {
  const [form, setForm] = useState<ContactInput>(contact ?? empty);
  const [tagText, setTagText] = useState((contact?.tags ?? []).join(", "));
  const save = useSaveContact(contact?.id);
  const set = (key: keyof ContactInput, value: string) => setForm({ ...form, [key]: value });
  const input = (key: keyof ContactInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} error={fieldError(save.error, key)}>
      {(field) => <Input {...field} {...props} value={String(form[key] ?? "")} onChange={(event) => set(key, event.target.value)} />}
    </Field>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={contact ? `Edit ${contact.name}` : "New contact"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { ...form, tags: tagText.split(",").map((tag) => tag.trim()).filter(Boolean) },
                {
                  onSuccess: (saved) => {
                    onSaved?.(saved);
                    onClose();
                    if (!contact) setForm(empty);
                  },
                },
              )
            }
          >
            {contact ? "Save contact" : "Create contact"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          {(field) => (
            <Select {...field} value={form.kind} onChange={(event) => set("kind", event.target.value)}>
              <option value="company">Company</option>
              <option value="person">Person</option>
            </Select>
          )}
        </Field>
        {input("name", form.kind === "company" ? "Company name" : "Full name", { required: true, autoFocus: true })}
        {input("email", "Email", { type: "email" })}
        {input("phone", "Phone", { type: "tel" })}
        {form.kind === "person" ? input("companyName", "Works at") : null}
        {input("companyCode", "Company code")}
        {input("vatCode", "VAT code")}
        {input("website", "Website")}
        <div className="sm:col-span-2">{input("address", "Street address")}</div>
        {input("city", "City")}
        <div className="grid grid-cols-2 gap-4">
          {input("postalCode", "Postal code")}
          {input("country", "Country", { maxLength: 2, placeholder: "LT" })}
        </div>
        <Field label="Tags" hint="Comma separated, e.g. vip, wholesale" className="sm:col-span-2">
          {(field) => <Input {...field} value={tagText} onChange={(event) => setTagText(event.target.value)} />}
        </Field>
        <Field label="Notes" className="sm:col-span-2" error={fieldError(save.error, "notes")}>
          {(field) => <Textarea {...field} value={form.notes} onChange={(event) => set("notes", event.target.value)} />}
        </Field>
      </div>
      <div className="mt-4">
        <FormError error={save.error} />
      </div>
    </Dialog>
  );
}

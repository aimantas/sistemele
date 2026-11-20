import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { api } from "@/app/lib/api";
import { Input } from "@/app/ui";
import type { Contact } from "../shared/schema";
import { useContacts } from "./api";

/**
 * Searchable contact selector for other modules' forms (quotes, invoices …).
 * Modules that list "crm" in `requires` may import it.
 */
export function ContactPicker({ value, onChange, id, invalid, disabled }: { value: string | null; onChange: (contact: Contact | null) => void; id?: string; invalid?: boolean; disabled?: boolean }) {
  const listId = useId();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useQuery({ queryKey: ["crm", "contact-summary", value], queryFn: () => api.get<{ contact: Contact }>(`/api/crm/contacts/${value}`).then((d) => d.contact), enabled: Boolean(value) });
  const results = useContacts({ q: term, limit: 8 });

  if (value && selected.data && !open) {
    return (
      <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-card px-3">
        <span className="min-w-0 truncate">
          <span className="font-medium">{selected.data.name}</span>
          {selected.data.email ? <span className="text-muted-foreground"> · {selected.data.email}</span> : null}
        </span>
        {!disabled ? (
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => (setOpen(true), setTerm(""))}>
            Change
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        placeholder="Search contacts by name or email"
        value={term}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => (setTerm(event.target.value), setOpen(true))}
      />
      {open ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {(results.data?.items ?? []).map((contact) => (
            <li key={contact.id} role="option" aria-selected={contact.id === value}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => (onChange(contact), setOpen(false))}>
                <span className="block font-medium">{contact.name}</span>
                <span className="block text-xs text-muted-foreground">{contact.email || contact.companyName || contact.phone || "No email"}</span>
              </button>
            </li>
          ))}
          {results.data && results.data.items.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No contacts match. Create one in CRM first.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

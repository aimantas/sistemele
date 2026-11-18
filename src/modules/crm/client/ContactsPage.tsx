import { Plus, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useFormat } from "@/app/lib/format";
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { useContacts } from "./api";
import { ContactFormDialog } from "./ContactForm";

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const format = useFormat();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? undefined;
  const offset = Number(params.get("offset") ?? 0);
  const contacts = useContacts({ q, tag, limit: PAGE_SIZE, offset });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (term !== q) setParams((current) => {
        const next = new URLSearchParams(current);
        if (term) next.set("q", term);
        else next.delete("q");
        next.delete("offset");
        return next;
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [term, q, setParams]);

  const total = contacts.data?.total ?? 0;
  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Customers, leads and suppliers. Website requests land here automatically."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            New contact
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search contacts" placeholder="Search name, email, company, phone" className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>
        {tag ? (
          <Button size="sm" variant="ghost" onClick={() => setParams({})}>
            Tag: {tag} ✕
          </Button>
        ) : null}
        <p className="ml-auto text-sm text-muted">{contacts.data ? `${total} contact${total === 1 ? "" : "s"}` : null}</p>
      </div>

      {contacts.error ? <ErrorState error={contacts.error} retry={() => contacts.refetch()} /> : null}
      {contacts.isLoading ? <Spinner /> : null}
      {contacts.data && contacts.data.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q || tag ? "No contacts match" : "No contacts yet"}
          description={q || tag ? "Try another search." : "Add your first customer, or share your website's contact page."}
          action={
            q || tag ? null : (
              <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
                New contact
              </Button>
            )
          }
        />
      ) : null}
      {contacts.data && contacts.data.items.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Email</Th>
                <Th className="hidden lg:table-cell">Phone</Th>
                <Th className="hidden sm:table-cell">Tags</Th>
                <Th className="hidden md:table-cell">Updated</Th>
              </tr>
            </thead>
            <tbody>
              {contacts.data.items.map((contact) => (
                <Tr key={contact.id}>
                  <Td>
                    <Link to={`/app/crm/contacts/${contact.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                      {contact.name}
                    </Link>
                    <p className="text-xs text-muted md:hidden">{contact.email || contact.phone}</p>
                    {contact.kind === "person" && contact.companyName ? <p className="text-xs text-muted">{contact.companyName}</p> : null}
                  </Td>
                  <Td className="hidden md:table-cell">{contact.email ? <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a> : <span className="text-muted">—</span>}</Td>
                  <Td className="hidden lg:table-cell">{contact.phone || <span className="text-muted">—</span>}</Td>
                  <Td className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((value) => (
                        <button key={value} type="button" onClick={() => setParams({ tag: value })}>
                          <Badge>{value}</Badge>
                        </button>
                      ))}
                    </div>
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted md:table-cell">{format.relative(contact.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" disabled={offset === 0} onClick={() => setParams((p) => (p.set("offset", String(Math.max(0, offset - PAGE_SIZE))), p))}>
                Previous
              </Button>
              <span className="text-sm text-muted">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setParams((p) => (p.set("offset", String(offset + PAGE_SIZE)), p))}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <ContactFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(contact) => navigate(`/app/crm/contacts/${contact.id}`)} />
    </div>
  );
}

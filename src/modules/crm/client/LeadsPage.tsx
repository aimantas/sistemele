import { clsx } from "clsx";
import { Inbox, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useFormat } from "@/app/lib/format";
import { Button, EmptyState, ErrorState, Input, PageHeader, Select, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { LEAD_FILTERS, LEAD_SOURCES, LEAD_STATUSES, type LeadFilter } from "../shared/schema";
import { useLeads, useTeam } from "./api";
import { LeadFormDialog } from "./LeadForm";
import { isDue, LeadStatusBadge, sourceLabel } from "./parts";

const PAGE_SIZE = 50;
const filterLabel = (filter: LeadFilter) => (filter === "open" ? "Open" : filter === "all" ? "All" : (LEAD_STATUSES.find((status) => status.id === filter)?.label ?? filter));

/** The leads inbox: filter by status, owner, source and due follow-ups; open a lead to work it. */
export default function LeadsPage() {
  const format = useFormat();
  const navigate = useNavigate();
  const team = useTeam();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const status = (LEAD_FILTERS as readonly string[]).includes(params.get("status") ?? "") ? (params.get("status") as LeadFilter) : "open";
  const ownerId = params.get("owner") ?? undefined;
  const source = params.get("source") ?? undefined;
  const due = params.get("due") === "1";
  const q = params.get("q") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  const leads = useLeads({ status, ownerId, source, q, due, limit: PAGE_SIZE, offset });

  const update = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete("offset");
      next.delete("new");
      return next;
    });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (term !== q) update({ q: term || null });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, q]);

  const counts = leads.data?.counts;
  const total = leads.data?.total ?? 0;
  const filtered = Boolean(q || ownerId || source || due);
  return (
    <div>
      <PageHeader
        title="Leads"
        actions={
          <Button variant="default" icon={<Plus />} onClick={() => setCreating(true)}>
            New lead
          </Button>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Lead status" className="flex w-max gap-1 border-b border-border">
          {LEAD_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={status === filter}
              onClick={() => update({ status: filter === "open" ? null : filter })}
              className={clsx("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap", status === filter ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {filterLabel(filter)}
              {counts ? <span className="tabular text-xs text-muted-foreground">{counts[filter]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search leads" placeholder="Search name, email, company" className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>
        <Select aria-label="Owner" className="w-auto" value={ownerId ?? ""} onChange={(event) => update({ owner: event.target.value || null })}>
          <option value="">Any owner</option>
          <option value="me">Mine</option>
          <option value="none">Unassigned</option>
          {(team.data ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Source" className="w-auto" value={source ?? ""} onChange={(event) => update({ source: event.target.value || null })}>
          <option value="">Any source</option>
          {LEAD_SOURCES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          aria-pressed={due}
          onClick={() => update({ due: due ? null : "1" })}
          className={clsx("h-10 rounded-full border px-4 text-sm font-medium", due ? "border-warning bg-warning/10 text-warning" : "border-border text-foreground/80 hover:border-input")}
        >
          Follow-up due{counts ? ` · ${counts.due}` : ""}
        </button>
      </div>

      {leads.error ? <ErrorState error={leads.error} retry={() => leads.refetch()} /> : null}
      {leads.isLoading ? <Spinner /> : null}
      {leads.data && leads.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={filtered || status !== "open" ? "No leads match" : "No open leads"}
          description={filtered || status !== "open" ? "Change the filters or search." : "Website requests land here. Add one you heard about elsewhere."}
          action={
            filtered || status !== "open" ? null : (
              <Button variant="default" icon={<Plus />} onClick={() => setCreating(true)}>
                New lead
              </Button>
            )
          }
        />
      ) : null}
      {leads.data && leads.data.items.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Lead</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Source</Th>
                <Th className="hidden lg:table-cell">Owner</Th>
                <Th className="hidden sm:table-cell">Follow up</Th>
                <Th className="hidden md:table-cell" align="right">
                  Value
                </Th>
                <Th className="hidden lg:table-cell">Created</Th>
              </tr>
            </thead>
            <tbody>
              {leads.data.items.map((lead) => {
                const overdue = isDue(lead.followUpOn) && ["new", "contacted", "qualified"].includes(lead.status);
                return (
                  <Tr key={lead.id}>
                    <Td>
                      <Link to={`/app/crm/leads/${lead.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {lead.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{[lead.company, lead.email].filter(Boolean).join(" · ")}</p>
                    </Td>
                    <Td>
                      <LeadStatusBadge status={lead.status} />
                    </Td>
                    <Td className="hidden md:table-cell">{sourceLabel(lead.source)}</Td>
                    <Td className="hidden lg:table-cell">{lead.ownerName ?? <span className="text-muted-foreground">Unassigned</span>}</Td>
                    <Td className={clsx("hidden whitespace-nowrap sm:table-cell", overdue && "font-medium text-destructive")}>{lead.followUpOn ? format.date(lead.followUpOn) : <span className="text-muted-foreground">—</span>}</Td>
                    <Td className="tabular hidden md:table-cell" align="right">
                      {lead.valueCents ? format.money(lead.valueCents) : <span className="text-muted-foreground">—</span>}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{format.relative(lead.createdAt)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setParams((p) => (p.set("offset", String(Math.max(0, offset - PAGE_SIZE))), p))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setParams((p) => (p.set("offset", String(offset + PAGE_SIZE)), p))}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <LeadFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(lead) => navigate(`/app/crm/leads/${lead.id}`)} />
    </div>
  );
}

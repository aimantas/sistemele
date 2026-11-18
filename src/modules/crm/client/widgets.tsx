import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import { useFormat } from "@/app/lib/format";
import { Spinner } from "@/app/ui";
import { DEAL_STAGES, OPEN_STAGES } from "../shared/schema";
import { useCompleteTask, useContacts, useDeals, useOpenTasks } from "./api";

/** Dashboard cards. Keep each one small: a title row, a few lines, a link to the full screen. */

export function PipelineWidget() {
  const format = useFormat();
  const deals = useDeals();
  if (!deals.data) return <Spinner />;
  const stages = DEAL_STAGES.filter((stage) => OPEN_STAGES.includes(stage.id));
  const max = Math.max(1, ...stages.map((stage) => deals.data.filter((deal) => deal.stage === stage.id).reduce((sum, deal) => sum + deal.valueCents, 0)));
  return (
    <div className="grid gap-3">
      {stages.map((stage) => {
        const items = deals.data.filter((deal) => deal.stage === stage.id);
        const value = items.reduce((sum, deal) => sum + deal.valueCents, 0);
        return (
          <Link key={stage.id} to="/app/crm/pipeline" className="group grid gap-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium group-hover:text-brand">
                {stage.label} <span className="text-muted">{items.length}</span>
              </span>
              <span className="tabular text-ink-soft">{format.money(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function OpenTasksWidget() {
  const format = useFormat();
  const tasks = useOpenTasks();
  const complete = useCompleteTask();
  if (!tasks.data) return <Spinner />;
  if (tasks.data.length === 0) return <p className="text-sm text-muted">No open tasks. Add one from a contact's timeline.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="grid gap-1">
      {tasks.data.slice(0, 12).map((task) => (
        <li key={task.id} className="flex items-start gap-2 rounded-control px-1 py-1.5 hover:bg-paper">
          <button type="button" aria-label={`Mark "${task.body}" done`} className="mt-0.5 text-muted hover:text-success" onClick={() => complete.mutate(task.id)}>
            <CheckCircle2 className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{task.body}</p>
            <p className="truncate text-xs text-muted">
              {task.contactId ? (
                <Link to={`/app/crm/contacts/${task.contactId}`} className="hover:underline">
                  {task.contactName}
                </Link>
              ) : null}
              {task.dueAt ? <span className={task.dueAt.slice(0, 10) < today ? "font-medium text-danger" : ""}> · due {format.date(task.dueAt)}</span> : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RecentContactsWidget() {
  const format = useFormat();
  const contacts = useContacts({ limit: 6 });
  if (!contacts.data) return <Spinner />;
  if (contacts.data.items.length === 0) return <p className="text-sm text-muted">No contacts yet.</p>;
  return (
    <ul className="grid gap-1">
      {contacts.data.items.map((contact) => (
        <li key={contact.id}>
          <Link to={`/app/crm/contacts/${contact.id}`} className="flex items-center justify-between gap-3 rounded-control px-1 py-1.5 hover:bg-paper">
            <span className="truncate text-sm font-medium">{contact.name}</span>
            <span className="shrink-0 text-xs text-muted">{format.relative(contact.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { useUser } from "@/app/lib/session";
import { Badge, Button, Card, CardHeader, Field, FormError, Input, Select, Textarea } from "@/app/ui";
import { ACTIVITY_KINDS, LEAD_SOURCES, LEAD_STATUSES, type Activity, type LeadStatus, type StageKind } from "../shared/schema";
import { useAddActivity, useCompleteTask, useTeam } from "./api";

/** Small pieces shared by the CRM screens. */

export const stageTone = (kind: StageKind) => (kind === "won" ? "success" : kind === "lost" ? "danger" : "info");

const leadTones: Record<LeadStatus, "neutral" | "info" | "brand" | "danger" | "success"> = { new: "info", contacted: "neutral", qualified: "brand", disqualified: "danger", converted: "success" };

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={leadTones[status]}>{LEAD_STATUSES.find((item) => item.id === status)?.label ?? status}</Badge>;
}

export const sourceLabel = (source: string) => LEAD_SOURCES.find((item) => item.id === source)?.label ?? source;

/** True when a YYYY-MM-DD follow-up date is today or earlier. */
export const isDue = (date: string | null) => Boolean(date && date.slice(0, 10) <= new Date().toISOString().slice(0, 10));

/** Owner picker: "Unassigned" plus active team members, the current user first. */
export function OwnerSelect({ value, onChange, label = "Owner", error, className }: { value: string | null; onChange: (ownerId: string | null) => void; label?: string; error?: string; className?: string }) {
  const team = useTeam();
  const user = useUser();
  const members = [...(team.data ?? [])].sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));
  return (
    <Field label={label} error={error} className={className}>
      {(props) => (
        <Select {...props} value={value ?? ""} disabled={team.isLoading} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === user.id ? `${member.name} (you)` : member.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Notes, calls, emails, meetings and tasks for a lead, contact or deal, newest first, with a form to add one. */
export function Timeline({ target, activities, emptyText }: { target: { contactId?: string; dealId?: string; leadId?: string }; activities: Activity[]; emptyText: string }) {
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
          add.mutate({ ...target, kind, body, dueAt: kind === "task" && dueAt ? dueAt : null }, { onSuccess: () => (setBody(""), setDueAt("")) });
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
          {kind === "task" ? <Field label="Due">{(props) => <Input {...props} type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-44" />}</Field> : null}
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
        {activities.length === 0 ? <li className="px-5 py-4 text-sm text-muted">{emptyText}</li> : null}
      </ol>
    </Card>
  );
}

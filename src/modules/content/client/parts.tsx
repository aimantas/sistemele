import { useFormat } from "@/app/lib/format";
import { Badge } from "@/app/ui";
import { ENTRY_STATE_LABELS, type EntryState, type EntrySummary } from "../shared/schema";

const stateTone = { draft: "neutral", scheduled: "info", published: "success", archived: "neutral" } as const;

export function StateBadge({ state }: { state: EntryState }) {
  return <Badge tone={stateTone[state]}>{ENTRY_STATE_LABELS[state]}</Badge>;
}

/** "Live since 3 Nov 2026", "Goes live 20 Nov 2026, 09:00", "Edited 2 hours ago". */
export function StateDate({ entry }: { entry: Pick<EntrySummary, "state" | "publishedAt" | "updatedAt"> }) {
  const format = useFormat();
  if (entry.state === "scheduled") return <>Goes live {format.dateTime(entry.publishedAt)}</>;
  if (entry.state === "published") return <>Live since {format.date(entry.publishedAt)}</>;
  return <>Edited {format.relative(entry.updatedAt)}</>;
}

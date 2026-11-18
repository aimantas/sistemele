import { Badge } from "@/app/ui";
import { quoteStatusLabel, type QuoteStatus } from "../shared/schema";

const tones = { draft: "neutral", sent: "info", accepted: "success", declined: "danger", expired: "warning" } as const;

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={tones[status]}>{quoteStatusLabel(status)}</Badge>;
}

/** Whole days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

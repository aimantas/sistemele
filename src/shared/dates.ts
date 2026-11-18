/** Date helpers. Calendar dates are "YYYY-MM-DD" strings; instants are ISO UTC. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDate(timeZone = "UTC", at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: value.length === 10 ? "UTC" : undefined }).format(date);
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export const isoDateSchemaPattern = /^\d{4}-\d{2}-\d{2}$/u;

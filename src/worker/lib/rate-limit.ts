import type { Db } from "./db";
import { tooManyRequests } from "./errors";

/**
 * Fixed-window limiter stored in D1. Good enough for sign-in and public forms;
 * swap for the Cloudflare Rate Limiting binding when traffic grows.
 */
export async function consumeRateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  // Now and then, drop windows older than a day so the table cannot grow forever.
  if (Math.random() < 0.02) await db.run("DELETE FROM rate_limits WHERE window_start < ?", [Math.floor(Date.now() / 1000) - 86_400]);
  const row = await db.first<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
    [key, windowStart],
  );
  return (row?.count ?? 1) <= limit;
}

export async function enforceRateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<void> {
  if (!(await consumeRateLimit(db, key, limit, windowSeconds))) throw tooManyRequests();
}

/**
 * The rate-limit key for a client address: an IPv4 address as is, an IPv6
 * address by its /64 network (one connection usually owns a whole /64, so
 * rotating addresses inside it must not reset the limit).
 */
export function clientAddressKey(address: string | undefined): string {
  if (!address) return "local";
  if (!address.includes(":")) return address;
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = address.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((group) => group.toLowerCase().replace(/^0+(?=.)/u, "")).join(":")}::/64`;
}

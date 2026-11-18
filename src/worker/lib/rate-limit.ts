import type { Db } from "./db";
import { tooManyRequests } from "./errors";

/**
 * Fixed-window limiter stored in D1. Good enough for sign-in and public forms;
 * swap for the Cloudflare Rate Limiting binding when traffic grows.
 */
export async function consumeRateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
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

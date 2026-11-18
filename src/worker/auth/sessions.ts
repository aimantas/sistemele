import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role, SessionUser } from "@/shared/auth";
import type { AppEnv, Env } from "../env";
import type { Db } from "../lib/db";
import { randomToken, sha256Hex } from "../lib/crypto";

const SESSION_DAYS = 30;
const REFRESH_AFTER_DAYS = 1;

/** `__Host-` cookies need HTTPS; plain http://localhost uses an unprefixed name. */
export function sessionCookieName(env: Pick<Env, "APP_URL">): string {
  return env.APP_URL.startsWith("https://") ? "__Host-sistemele_session" : "sistemele_session";
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
}

export async function createSession(c: Context<AppEnv>, db: Db, userId: string): Promise<void> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.batch([
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)", [
      await sha256Hex(token),
      userId,
      expires.toISOString(),
      (c.req.header("user-agent") ?? "").slice(0, 300),
    ]),
    db.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [userId]),
    db.prepare("DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"),
  ]);
  setCookie(c, sessionCookieName(c.env), token, {
    httpOnly: true,
    secure: c.env.APP_URL.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    expires,
  });
}

export async function userFromSession(c: Context<AppEnv>, db: Db): Promise<SessionUser | null> {
  const token = getCookie(c, sessionCookieName(c.env));
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db.first<UserRow & { expires_at: string }>(
    `SELECT u.id, u.email, u.name, u.role, u.status, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    [tokenHash],
  );
  if (!row || row.status !== "active" || row.expires_at < new Date().toISOString()) return null;

  // Sliding expiry: extend at most once a day to keep writes rare.
  const remainingMs = new Date(row.expires_at).getTime() - Date.now();
  if (remainingMs < (SESSION_DAYS - REFRESH_AFTER_DAYS) * 86_400_000) {
    const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await db.run("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [expires.toISOString(), tokenHash]);
    setCookie(c, sessionCookieName(c.env), token, { httpOnly: true, secure: c.env.APP_URL.startsWith("https://"), sameSite: "Lax", path: "/", expires });
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, via: "session" };
}

export async function userFromApiToken(db: Db, header: string | undefined): Promise<SessionUser | null> {
  const match = header?.match(/^Bearer\s+(sk_[A-Za-z0-9_-]{20,})$/u);
  if (!match) return null;
  const row = await db.first<UserRow & { token_id: string; token_role: Role }>(
    `SELECT u.id, u.email, u.name, u.role, u.status, t.id AS token_id, t.role AS token_role
     FROM api_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.revoked_at IS NULL`,
    [await sha256Hex(match[1])],
  );
  if (!row || row.status !== "active") return null;
  await db.run("UPDATE api_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [row.token_id]);
  // A token never grants more than its owner currently has.
  const rank = { member: 1, admin: 2, owner: 3 } as const;
  const role = rank[row.token_role] <= rank[row.role] ? row.token_role : row.role;
  return { id: row.id, email: row.email, name: row.name, role, via: "token" };
}

export async function destroySession(c: Context<AppEnv>, db: Db): Promise<void> {
  const token = getCookie(c, sessionCookieName(c.env));
  if (token) await db.run("DELETE FROM sessions WHERE token_hash = ?", [await sha256Hex(token)]);
  deleteCookie(c, sessionCookieName(c.env), { path: "/", secure: c.env.APP_URL.startsWith("https://") });
}

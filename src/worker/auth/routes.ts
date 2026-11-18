import { Hono } from "hono";
import { z } from "zod";
import { newId } from "@/shared/ids";
import { getContext } from "../context";
import { renderEmail } from "../email/layout";
import { appOrigin, isDevelopment, type AppEnv, type Env } from "../env";
import { randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, unauthorized } from "../lib/errors";
import { enforceRateLimit } from "../lib/rate-limit";
import { readJson } from "../lib/validate";
import { createSession, destroySession } from "./sessions";

const LINK_MINUTES = 15;

export function adminEmails(env: Pick<Env, "ADMIN_EMAILS">): string[] {
  return env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

/** Only on a local machine in development without email configured. Never on a deployed Worker. */
function canShowDevLink(env: Env, requestUrl: string): boolean {
  const host = new URL(requestUrl).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  return isDevelopment(env) && !env.RESEND_API_KEY && local && env.APP_URL.startsWith("http://");
}

const requestSchema = z.object({ email: z.email().max(254).transform((email) => email.trim().toLowerCase()) });
const verifySchema = z.object({ token: z.string().min(20).max(200) });

/**
 * Passwordless sign-in. POST /api/auth/link emails a one-time link to
 * /app/login/verify?token=…; that page POSTs the token to /api/auth/verify.
 * Verification is a POST so email scanners that prefetch links cannot burn it.
 */
export const authRoutes = new Hono<AppEnv>()
  .post("/link", async (c) => {
    const ctx = getContext(c);
    const { email } = await readJson(c, requestSchema);
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    await enforceRateLimit(ctx.db, `login:ip:${ip}`, 20, 900);
    await enforceRateLimit(ctx.db, `login:email:${email}`, 5, 900);

    const user = await ctx.db.first<{ id: string; status: string }>("SELECT id, status FROM users WHERE email = ?", [email]);
    const allowed = user ? user.status === "active" : adminEmails(c.env).includes(email);
    let devLink: string | undefined;

    if (allowed) {
      const token = randomToken();
      await ctx.db.run("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)", [
        await sha256Hex(token),
        email,
        new Date(Date.now() + LINK_MINUTES * 60_000).toISOString(),
      ]);
      const url = `${appOrigin(c.env)}/app/login/verify?token=${encodeURIComponent(token)}`;
      const content = renderEmail({
        preheader: `Your sign-in link for ${c.env.APP_NAME}. It works once, for ${LINK_MINUTES} minutes.`,
        heading: `Sign in to ${c.env.APP_NAME}`,
        paragraphs: [`Use the button below to sign in. The link works once and expires in ${LINK_MINUTES} minutes.`, "If you did not ask to sign in, ignore this email."],
        action: { label: "Sign in", url },
        footer: `${c.env.APP_NAME} · ${appOrigin(c.env)}`,
      });
      await ctx.sendEmail({ to: email, subject: `Sign in to ${c.env.APP_NAME}`, template: "auth.sign_in_link", ...content });
      if (canShowDevLink(c.env, c.req.url)) devLink = url;
    }

    // Same answer whether or not the address exists, so emails cannot be probed.
    return c.json({ ok: true, ...(devLink ? { devLink } : {}) });
  })

  .post("/verify", async (c) => {
    const ctx = getContext(c);
    const { token } = await readJson(c, verifySchema);
    const tokenHash = await sha256Hex(token);
    const row = await ctx.db.first<{ email: string }>(
      `UPDATE login_tokens SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       RETURNING email`,
      [tokenHash],
    );
    if (!row) throw badRequest("This sign-in link has expired or was already used. Request a new one.");

    let user = await ctx.db.first<{ id: string; status: string }>("SELECT id, status FROM users WHERE email = ?", [row.email]);
    if (!user && adminEmails(c.env).includes(row.email)) {
      const id = newId("usr");
      await ctx.db.run("INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'owner')", [id, row.email, row.email.split("@")[0]]);
      user = { id, status: "active" };
    }
    if (!user || user.status !== "active") throw unauthorized("This account cannot sign in. Ask an owner for access.");

    await createSession(c, ctx.db, user.id);
    return c.json({ ok: true });
  })

  .post("/logout", async (c) => {
    await destroySession(c, getContext(c).db);
    return c.json({ ok: true });
  })

  .get("/session", (c) => c.json({ user: c.get("user") }));

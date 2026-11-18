import type { Env } from "../env";
import { badRequest } from "./errors";

/**
 * Optional Cloudflare Turnstile check for public forms. Does nothing until
 * TURNSTILE_SECRET_KEY is set; then a valid token is required.
 */
export async function verifyTurnstile(env: Pick<Env, "TURNSTILE_SECRET_KEY">, token: unknown, ip: string): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (typeof token !== "string" || !token) throw badRequest("Confirm you are human and send again.");
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (ip !== "local") body.append("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const result = (await response.json().catch(() => ({ success: false }))) as { success?: boolean };
  if (!result.success) throw badRequest("Confirm you are human and send again.");
}

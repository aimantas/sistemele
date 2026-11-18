import { newId } from "@/shared/ids";
import { isDemo, type Env } from "../env";
import type { Db } from "../lib/db";
import type { RenderedEmail } from "./layout";

export interface OutgoingEmail extends RenderedEmail {
  to: string;
  subject: string;
  /** Template id for the email log, e.g. "auth.magic_link" or "invoices.issued". */
  template: string;
  replyTo?: string;
  related?: { type: string; id: string };
}

export type EmailStatus = "sent" | "logged" | "failed";

/** True when email can really be sent. A demo never sends email, even with a key. */
export function emailConfigured(env: Pick<Env, "RESEND_API_KEY" | "DEMO_MODE">): boolean {
  return Boolean(env.RESEND_API_KEY) && !isDemo(env);
}

/**
 * Sends through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Without RESEND_API_KEY the email is printed to the console and logged as
 * "logged", so local development and tests never send real mail.
 * Every attempt is written to email_log. Callers decide whether a failure
 * is fatal; this function never throws for provider errors.
 */
export async function sendEmail(env: Env, db: Db, email: OutgoingEmail): Promise<{ status: EmailStatus; id: string }> {
  const id = newId("eml");
  let status: EmailStatus = "logged";
  let providerId: string | null = null;
  let error: string | null = null;

  if (!emailConfigured(env)) {
    console.info(`[email:${email.template}] to=${email.to} subject="${email.subject}"\n${email.text}`);
  } else {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          reply_to: email.replyTo,
          tags: [{ name: "template", value: email.template.replace(/[^a-zA-Z0-9_-]/gu, "_") }],
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (response.ok) {
        status = "sent";
        providerId = body.id ?? null;
      } else {
        status = "failed";
        error = `${response.status} ${body.message ?? "Resend rejected the email"}`.slice(0, 500);
      }
    } catch (cause) {
      status = "failed";
      error = cause instanceof Error ? cause.message.slice(0, 500) : "Network error";
    }
  }

  await db.run(
    `INSERT INTO email_log (id, to_address, subject, template, status, provider_id, error, related_type, related_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, email.to, email.subject, email.template, status, providerId, error, email.related?.type ?? null, email.related?.id ?? null],
  );
  if (status === "failed") console.error(`[email:${email.template}] failed: ${error}`);
  return { status, id };
}

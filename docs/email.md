# Email (Resend)

All email goes through `ctx.sendEmail()` (`src/worker/email/send.ts`), which
calls the [Resend API](https://resend.com/docs/api-reference/emails/send-email)
with `fetch` — no SDK. Every attempt is written to `email_log`
(Settings → Email shows it).

| Situation | Result |
| --- | --- |
| `RESEND_API_KEY` missing | Email printed to the Worker log, status `logged`. Local sign-in links also appear on the sign-in screen. |
| Resend accepts | Status `sent`, provider id stored. |
| Resend rejects / network error | Status `failed` with the error. The calling action still succeeds unless the caller decides otherwise. |

## Setup

1. Create a Resend account, add your domain, add the DNS records it shows (SPF, DKIM; DMARC recommended).
2. Create an API key with "Sending access" only.
3. `npx wrangler secret put RESEND_API_KEY`
4. Set `EMAIL_FROM` in `wrangler.jsonc`, e.g. `"Northwind <office@northwind.example>"` (must be on the verified domain).
5. Deploy and request a sign-in link to test.

Locally, put the key in `.dev.vars` only if you really want to send. Resend's
`onboarding@resend.dev` sender only delivers to your own account address.

## Emails the system sends

| Template id | When | To |
| --- | --- | --- |
| `auth.sign_in_link` | Sign-in requested | The user |
| `core.user_invited` | A person is added to the team | The new user |
| `crm.inquiry_received` | Website request | Business email (Settings) |
| `quotes.sent` | Quote sent | Customer contact |
| `quotes.responded` | Customer accepted/declined | Business email |
| `invoices.sent` | Invoice sent | Customer contact |

## Writing a new email

```ts
import { renderEmail } from "@/worker/email/layout";

const content = renderEmail({
  preheader: "Your booking is confirmed for 3 March at 10:00.",
  heading: "Booking confirmed",
  paragraphs: ["We look forward to seeing you.", "Reply to this email to change the time."],
  facts: [["Service", "Annual check"], ["When", "3 March, 10:00"]],
  action: { label: "View booking", url: `${appOrigin(ctx.env)}/b/${token}` },
  footer: `${business.name} · ${business.address}`,
});
ctx.waitUntil(ctx.sendEmail({ to, subject: "Booking confirmed", template: "bookings.confirmed", related: { type: "booking", id }, ...content }));
```

`renderEmail` escapes all text, produces table-based HTML that survives
Outlook, and a plain-text part. Keep emails short: what happened, what to do,
one button.

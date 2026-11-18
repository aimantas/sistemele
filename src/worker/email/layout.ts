/**
 * Transactional email layout. Table-based HTML with inline styles so it renders
 * in Gmail, Outlook and Apple Mail. Every email also gets a plain-text part.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

export interface EmailContent {
  /** Short line shown by inboxes next to the subject. */
  preheader: string;
  heading: string;
  /** Plain paragraphs; they are escaped. */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Optional key/value rows, e.g. invoice number and total. */
  facts?: Array<[label: string, value: string]>;
  footer: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const paragraphs = content.paragraphs
    .map((text) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1d232b;">${escapeHtml(text)}</p>`)
    .join("");
  const facts = content.facts?.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:8px 0 24px;">${content.facts
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 0;border-top:1px solid #e3e6e8;font-size:14px;color:#5b6570;">${escapeHtml(label)}</td><td align="right" style="padding:8px 0;border-top:1px solid #e3e6e8;font-size:14px;font-weight:600;color:#1d232b;">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const action = content.action
    ? `<table role="presentation" style="margin:8px 0 24px;"><tr><td style="background:#1d232b;border-radius:8px;"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(content.action.label)}</a></td></tr></table>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preheader)}</span>
<table role="presentation" width="100%" style="border-collapse:collapse;background:#f4f4f1;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #e3e6e8;border-radius:12px;">
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#1d232b;">${escapeHtml(content.heading)}</h1>
${paragraphs}${facts}${action}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:18px;color:#6b7580;">${escapeHtml(content.footer)}</p>
</td></tr></table></body></html>`;

  const text = [
    content.heading,
    "",
    ...content.paragraphs.flatMap((p) => [p, ""]),
    ...(content.facts ?? []).map(([label, value]) => `${label}: ${value}`),
    content.facts?.length ? "" : null,
    content.action ? `${content.action.label}: ${content.action.url}` : null,
    "",
    content.footer,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { html, text };
}

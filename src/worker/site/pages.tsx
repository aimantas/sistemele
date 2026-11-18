import { Hono } from "hono";
import { Fragment } from "react";
import type { HomeContribution, ServerModule } from "@/modules/types.server";
import { getContext } from "../context";
import { appOrigin, type AppEnv } from "../env";
import { siteContent } from "./content";
import { renderPage } from "./render";
import { breadcrumbJsonLd, organizationJsonLd } from "./seo";

/**
 * Core public pages: home, contact (quote request), privacy. The home page
 * shows the copy from ./content.ts unless a module supplies a hero (the
 * content module's "home" page), followed by sections modules add.
 */
export function sitePages(modules: readonly ServerModule[]) {
  const hasCrm = modules.some((module) => module.id === "crm");
  const hasCatalog = modules.some((module) => module.id === "catalog");

  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const ctx = getContext(c);
      const origin = appOrigin(c.env);
      const business = await ctx.business();
      const home = siteContent.home;
      // Modules add sections (e.g. latest posts) and may replace the hero text (a "home" page in the content module).
      const contributions = await Promise.all(
        modules.map((module) =>
          (module.home?.(ctx) ?? Promise.resolve<HomeContribution>({})).catch((error: unknown) => {
            console.error(`Home page section from ${module.id} failed`, error);
            return {} as HomeContribution;
          }),
        ),
      );
      const hero = contributions.find((contribution) => contribution.hero)?.hero;
      const sections = contributions.flatMap((contribution) => contribution.sections ?? []);
      const headline = hero?.title ?? home.headline;
      const lead = hero?.lead ?? home.lead;
      const steps = hero ? null : home.steps;

      return renderPage(c, {
        meta: {
          title: business.name,
          description: hero?.description || home.description,
          path: "/",
          ogImage: hero?.image ? (hero.image.startsWith("/") ? `${origin}${hero.image}` : hero.image) : undefined,
          jsonLd: [organizationJsonLd(business, origin), { "@context": "https://schema.org", "@type": "WebSite", name: business.name, url: origin }],
        },
        markdown: [
          `# ${business.name}`,
          "",
          headline,
          "",
          ...(lead ? [lead, ""] : []),
          ...(steps ? ["## How it works", "", ...steps.map((step, i) => `${i + 1}. **${step.title}** — ${step.text}`), ""] : []),
          ...sections.flatMap((section) => [section.markdown.trim(), ""]),
          ...(hasCrm ? [`[${home.primaryCta.label}](${origin}${home.primaryCta.href})`, ""] : []),
        ].join("\n"),
        body: (
          <>
            <section className="hero">
              <div className="wrap">
                {hero ? null : <p className="eyebrow">{home.eyebrow}</p>}
                <h1>{headline}</h1>
                {lead ? <p className="lead">{lead}</p> : null}
                <div className="actions">
                  {hasCrm ? (
                    <a className="button primary" href={home.primaryCta.href}>
                      {home.primaryCta.label}
                    </a>
                  ) : null}
                  {hasCatalog ? (
                    <a className="button" href={home.secondaryCta.href}>
                      {home.secondaryCta.label}
                    </a>
                  ) : null}
                </div>
              </div>
            </section>
            {steps ? (
              <section className="section">
                <div className="wrap">
                  <h2>How it works</h2>
                  <ol className="steps">
                    {steps.map((step) => (
                      <li key={step.title}>
                        <h3>{step.title}</h3>
                        <p>{step.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            ) : null}
            {sections.map((section) => (
              <Fragment key={section.id}>{section.body}</Fragment>
            ))}
          </>
        ),
      });
    })

    .get("/contact", async (c) => {
      if (!hasCrm) return c.notFound();
      const origin = appOrigin(c.env);
      const sent = c.req.query("sent") === "1";
      const error = c.req.query("error");
      const content = siteContent.contact;
      return renderPage(c, {
        meta: { title: content.title, description: content.description, path: "/contact", jsonLd: [breadcrumbJsonLd(origin, [{ name: "Home", path: "/" }, { name: content.title, path: "/contact" }])] },
        markdown: `# ${content.title}\n\n${content.lead}\n\nSend a POST request to ${origin}/api/public/crm/inquiries with JSON fields: name, email, phone (optional), company (optional), message.\n`,
        body: (
          <section className="section">
            <div className="wrap narrow">
              <h1>{content.title}</h1>
              <p className="lead">{content.lead}</p>
              {sent ? (
                <p className="notice success" role="status">
                  {content.success}
                </p>
              ) : null}
              {error ? (
                <p className="notice error" role="alert">
                  {error === "rate_limited" ? "Too many requests from your connection. Try again in a few minutes." : "Check your name, email and message, then send again."}
                </p>
              ) : null}
              <form className="form" method="post" action="/api/public/crm/inquiries">
                <label>
                  Your name
                  <input name="name" autoComplete="name" required maxLength={120} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                </label>
                <label>
                  Phone <span className="muted">(optional)</span>
                  <input name="phone" type="tel" autoComplete="tel" maxLength={50} />
                </label>
                <label>
                  Company <span className="muted">(optional)</span>
                  <input name="company" autoComplete="organization" maxLength={200} />
                </label>
                <label>
                  What do you need?
                  <textarea name="message" rows={6} required maxLength={5000} placeholder="Product or service, quantity, sizes, delivery date" />
                </label>
                <input className="trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                <button className="button primary" type="submit">
                  Send request
                </button>
                <p className="muted small">
                  We use these details only to reply to your request. See the <a href="/privacy">privacy policy</a>.
                </p>
              </form>
            </div>
          </section>
        ),
      });
    })

    .get("/privacy", async (c) => {
      const business = await getContext(c).business();
      const content = siteContent.privacy;
      const controller = business.legalName || business.name;
      return renderPage(c, {
        meta: { title: content.title, description: content.description, path: "/privacy" },
        markdown: `# ${content.title}\n\n${controller} is responsible for the data described here.`,
        body: (
          <section className="section">
            <div className="wrap narrow prose">
              <h1>{content.title}</h1>
              <p>
                {controller}
                {business.companyCode ? ` (company code ${business.companyCode})` : ""} is responsible for the personal data collected through this website.
              </p>
              <h2>What we collect</h2>
              <p>When you send a request, we keep your name, email, phone, company and message so we can prepare and send a quote. When you accept a quote or receive an invoice, we keep the details the law requires on those documents.</p>
              <h2>Why</h2>
              <p>To answer your request and fulfil the order you ask for. Invoices are kept for the period accounting law requires.</p>
              <h2>Who processes it</h2>
              <p>The site runs on Cloudflare. Emails are delivered through our email provider. We do not sell your data and do not use it for advertising.</p>
              <h2>Your rights</h2>
              <p>
                Ask us for a copy of your data, a correction or deletion
                {business.email ? (
                  <>
                    {" "}
                    at <a href={`mailto:${business.email}`}>{business.email}</a>
                  </>
                ) : null}
                .
              </p>
            </div>
          </section>
        ),
      });
    });
}

export async function renderNotFound(c: Parameters<typeof renderPage>[0]): Promise<Response> {
  return renderPage(c, {
    status: 404,
    meta: { title: "Page not found", description: "This page does not exist.", path: new URL(c.req.url).pathname, noindex: true },
    markdown: "# Page not found\n",
    body: (
      <section className="section">
        <div className="wrap narrow">
          <h1>Page not found</h1>
          <p className="lead">The address may have changed. Start from the home page.</p>
          <a className="button primary" href="/">
            Go to the home page
          </a>
        </div>
      </section>
    ),
  });
}

import { Hono } from "hono";
import type { ReactNode } from "react";
import type { ServerModule } from "@/modules/types.server";
import { appOrigin, type AppEnv } from "../../env";
import { renderPage } from "../render";
import { breadcrumbJsonLd } from "../seo";
import { renderDocMarkdown } from "./markdown";
import { DOC_GROUPS, DOCS, REPO_URL, docHref, docImage, findDoc, type DocEntry } from "./sources";
import { AgentLoop, ArchitectureDiagram, ModuleAnatomy, RuleGrid, SkillFiles, ToolChart, WritePath, visualsMarkdown } from "./visuals";

/**
 * /docs: this kit's documentation, rendered from the repository files at
 * build time. The index shows how the pieces fit (diagrams and a tools chart
 * built from the running code); each page renders one file with a sidebar,
 * an "On this page" list and a link to its source. Agents get the original
 * Markdown with `Accept: text/markdown`. Enabled by `site.docs` in
 * sistemele.config.ts.
 */
export function docsRoutes(modules: readonly ServerModule[]) {
  /** Visuals shown above a page's text, where they explain it best. */
  const visualsFor: Record<string, () => ReactNode> = {
    agents: () => (
      <>
        <RuleGrid />
        <AgentLoop />
      </>
    ),
    skill: () => <SkillFiles />,
    extending: () => <AgentLoop />,
    architecture: () => (
      <>
        <ArchitectureDiagram modules={modules} />
        <WritePath />
      </>
    ),
    modules: () => <ModuleAnatomy />,
    "ai-agents": () => <ToolChart modules={modules} />,
  };

  return new Hono<AppEnv>()
    .get("/docs", (c) => {
      const origin = appOrigin(c.env);
      return renderPage(c, {
        edit: {
          summary: "The docs are Markdown files in the repository, rendered on each build. This overview and its diagrams are code.",
          files: [
            { path: "src/worker/site/docs/routes.tsx", note: "This overview and the page layout" },
            { path: "src/worker/site/docs/visuals.tsx", note: "Diagrams and the tools chart" },
            { path: "src/worker/site/docs/sources.ts", note: "Which files appear, in which group and order" },
          ],
        },
        meta: {
          title: "Documentation",
          description: "How to build on Sistemėlė: AGENTS.md, the agent skill, and guides for modules, the dashboard, MCP, design and deployment.",
          path: "/docs",
          jsonLd: [breadcrumbJsonLd(origin, [{ name: "Docs", path: "/docs" }])],
        },
        markdown: [
          "# Documentation",
          "",
          ...DOC_GROUPS.flatMap((group) => [`## ${group}`, "", ...DOCS.filter((doc) => doc.group === group).map((doc) => `- [${doc.title}](${origin}/docs/${doc.slug}): ${doc.summary}`), ""]),
          visualsMarkdown(modules),
        ].join("\n"),
        body: (
          <DocsShell current="">
            <header className="docs-head">
              <h1>Documentation</h1>
              <p className="lead">Everything a coding agent or a developer needs to build on Sistemėlė: the rules agents read first, the installable skill, and a guide for every part.</p>
              <div className="actions">
                <a className="button primary" href="/docs/agents">
                  Read AGENTS.md
                </a>
                <a className="button" href="/docs/skill">
                  Install the agent skill
                </a>
                <a className="button" href="/docs/getting-started">
                  Getting started
                </a>
              </div>
            </header>

            <section className="docs-section" aria-labelledby="fits">
              <h2 id="fits">How it fits together</h2>
              <ArchitectureDiagram modules={modules} />
            </section>

            <section className="docs-section" aria-labelledby="rules">
              <h2 id="rules">Rules every change keeps</h2>
              <RuleGrid />
            </section>

            <section className="docs-section" aria-labelledby="agents">
              <h2 id="agents">How an agent works here</h2>
              <AgentLoop />
              <SkillFiles />
            </section>

            <section className="docs-section" aria-labelledby="tools">
              <h2 id="tools">What agents can do</h2>
              <div className="docs-pair">
                <ToolChart modules={modules} />
                <WritePath />
              </div>
            </section>

            <section className="docs-section" aria-labelledby="all">
              <h2 id="all">All docs</h2>
              {DOC_GROUPS.map((group) => (
                <div key={group} className="docs-group">
                  <h3>{group}</h3>
                  <ul className="plain docs-list">
                    {DOCS.filter((doc) => doc.group === group).map((doc) => (
                      <li key={doc.slug}>
                        <a href={`/docs/${doc.slug}`}>{doc.title}</a>
                        <span>{doc.summary}</span>
                        <code>{doc.path}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </DocsShell>
        ),
      });
    })

    .get("/docs/:slug{.+}", (c) => {
      const origin = appOrigin(c.env);
      const doc = findDoc(c.req.param("slug").replace(/\/$/u, ""));
      if (!doc) return c.notFound();
      const rendered = renderDocMarkdown(doc.source, { resolveHref: (href) => docHref(doc.path, href), resolveImage: (src) => docImage(doc.path, src) });
      const index = DOCS.indexOf(doc);
      const previous = DOCS[index - 1];
      const next = DOCS[index + 1];
      const toc = rendered.headings.filter((heading) => heading.level === 2);
      const visual = visualsFor[doc.slug]?.();

      return renderPage(c, {
        edit: {
          summary: "This page is a Markdown file in the repository. Edit it on GitHub or locally; it is rendered on the next deploy.",
          files: [
            { path: doc.path, note: "The text of this page" },
            { path: "src/worker/site/docs/sources.ts", note: "Title, summary, group and order in the sidebar" },
          ],
        },
        meta: {
          title: `${doc.title} · Docs`,
          description: doc.summary,
          path: `/docs/${doc.slug}`,
          jsonLd: [
            breadcrumbJsonLd(origin, [
              { name: "Docs", path: "/docs" },
              { name: doc.title, path: `/docs/${doc.slug}` },
            ]),
          ],
        },
        markdown: doc.source,
        body: (
          <DocsShell current={doc.slug} toc={toc}>
            <header className="docs-head">
              <p className="docs-crumb">
                <a href="/docs">Docs</a> <span aria-hidden="true">/</span> {doc.group}
              </p>
              <h1>{doc.title}</h1>
              <p className="lead">{doc.summary}</p>
              <p className="docs-meta">
                <a href={`${REPO_URL}/blob/main/${doc.path}`}>{doc.path}</a>
                <span aria-hidden="true">·</span>
                <a href={`${REPO_URL}/raw/main/${doc.path}`}>Raw Markdown</a>
              </p>
            </header>
            {visual ? <div className="docs-visuals">{visual}</div> : null}
            {toc.length > 2 ? (
              <details className="docs-toc-mobile">
                <summary>On this page</summary>
                <TocList toc={toc} />
              </details>
            ) : null}
            <div className="docs-prose" dangerouslySetInnerHTML={{ __html: rendered.html }} />
            <nav className="docs-pager" aria-label="Previous and next">
              {previous ? (
                <a href={`/docs/${previous.slug}`} rel="prev">
                  <span>Previous</span>
                  {previous.title}
                </a>
              ) : (
                <span />
              )}
              {next ? (
                <a href={`/docs/${next.slug}`} rel="next" className="next">
                  <span>Next</span>
                  {next.title}
                </a>
              ) : null}
            </nav>
          </DocsShell>
        ),
      });
    });
}

function TocList({ toc }: { toc: Array<{ id: string; text: string }> }) {
  return (
    <ul className="plain">
      {toc.map((heading) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`}>{heading.text}</a>
        </li>
      ))}
    </ul>
  );
}

function DocsNav({ current }: { current: string }) {
  return (
    <>
      <a className={current === "" ? "docs-nav-home active" : "docs-nav-home"} href="/docs" aria-current={current === "" ? "page" : undefined}>
        Overview
      </a>
      {DOC_GROUPS.map((group) => (
        <div key={group} className="docs-nav-group">
          <p>{group}</p>
          <ul className="plain">
            {DOCS.filter((doc: DocEntry) => doc.group === group).map((doc) => (
              <li key={doc.slug}>
                <a href={`/docs/${doc.slug}`} aria-current={doc.slug === current ? "page" : undefined}>
                  {doc.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function DocsShell({ current, toc, children }: { current: string; toc?: Array<{ id: string; text: string }>; children: ReactNode }) {
  return (
    <div className="wrap docs">
      <details className="docs-menu">
        <summary>All docs</summary>
        <nav aria-label="Docs">
          <DocsNav current={current} />
        </nav>
      </details>
      <nav className="docs-sidebar" aria-label="Docs">
        <DocsNav current={current} />
      </nav>
      <article className="docs-main">{children}</article>
      {toc && toc.length > 2 ? (
        <aside className="docs-toc" aria-label="On this page">
          <p>On this page</p>
          <TocList toc={toc} />
        </aside>
      ) : null}
    </div>
  );
}

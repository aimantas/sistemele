import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderDocMarkdown } from "@/worker/site/docs/markdown";
import { DOCS, docHref, docImage } from "@/worker/site/docs/sources";
import { nonNegotiables } from "@/worker/site/docs/visuals";
import { createTestApp, type TestApp } from "./helpers";

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.dispose());

describe("docs markdown", () => {
  it("renders the parts the docs use and escapes HTML", () => {
    const doc = renderDocMarkdown(
      [
        "---",
        "name: example",
        "description: An example.",
        "---",
        "# Title",
        "",
        "Intro with **bold**, *italic*, `code <b>` and [a link](extending.md).",
        "",
        "## Set up",
        "",
        "1. First",
        "2. Second:",
        "",
        "   ```bash",
        "   npm run dev",
        "   ```",
        "",
        "- [ ] open",
        "- [x] done",
        "  - nested",
        "",
        "| Path | What |",
        "| --- | --- |",
        "| `a|b` | One \\| two |",
        "",
        "> Quoted",
        "",
        "<script>alert(1)</script>",
      ].join("\n"),
      { resolveHref: (href) => docHref("docs/getting-started.md", href) },
    );
    expect(doc.title).toBe("Title");
    expect(doc.frontMatter).toEqual({ name: "example", description: "An example." });
    expect(doc.headings).toEqual([{ id: "set-up", text: "Set up", level: 2 }]);
    expect(doc.html).toContain('<h2 id="set-up">');
    expect(doc.html).toContain("<strong>bold</strong>");
    expect(doc.html).toContain("<em>italic</em>");
    expect(doc.html).toContain("<code>code &lt;b&gt;</code>");
    expect(doc.html).toContain('<a href="/docs/extending">a link</a>');
    // A blank line inside an item makes the whole list loose, so every item is a paragraph.
    expect(doc.html).toContain('<ol><li><p>First</p></li><li><p>Second:</p>\n<pre class="code" data-lang="bash"><code>npm run dev</code></pre></li></ol>');
    expect(doc.html).toContain('<li class="task"><input type="checkbox" disabled /> open</li>');
    expect(doc.html).toContain("checked /> <p>done</p>\n<ul><li>nested</li></ul>");
    expect(doc.html).toContain("<td><code>a|b</code></td><td>One | two</td>");
    expect(doc.html).toContain("<blockquote><p>Quoted</p></blockquote>");
    expect(doc.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(doc.html).not.toContain("<script>");
  });

  it("links docs to /docs and other repository files to GitHub", () => {
    expect(docHref("docs/extending.md", "../AGENTS.md")).toBe("/docs/agents");
    expect(docHref("docs/extending.md", "modules.md#contract")).toBe("/docs/modules#contract");
    expect(docHref("skills/sistemele/SKILL.md", "references/mcp.md")).toBe("/docs/skill/mcp");
    expect(docHref("docs/extending.md", "../src/modules/crm/README.md")).toBe("https://github.com/aimantas/sistemele/blob/main/src/modules/crm/README.md");
    expect(docHref("docs/extending.md", "https://example.com")).toBe("https://example.com");
    expect(docImage("README.md", "docs/images/dashboard.jpg")).toBe("https://github.com/aimantas/sistemele/raw/main/docs/images/dashboard.jpg");
  });

  it("bundles every listed doc, including AGENTS.md and the skill", () => {
    const slugs = DOCS.map((doc) => doc.slug);
    expect(slugs).toEqual(expect.arrayContaining(["agents", "skill", "skill/mcp", "getting-started", "design-system", "design-rules"]));
    for (const doc of DOCS) expect(doc.source.length, doc.path).toBeGreaterThan(100);
  });

  it("reads the non-negotiables from AGENTS.md", () => {
    const rules = nonNegotiables();
    expect(rules.length).toBeGreaterThanOrEqual(6);
    expect(rules[0].title).toContain("Money is integer cents");
  });
});

describe("docs pages", () => {
  it("shows the overview with diagrams, the rules and the tools chart", async () => {
    const response = await t.request("/docs");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<h1>Documentation</h1>");
    expect(html).toContain("One Cloudflare Worker (Hono)");
    expect(html).toContain("Rules every change keeps");
    expect(html).toMatch(/MCP tools per module <span>\d+ in total<\/span>/u);
    expect(html).toContain('<a href="/docs" aria-current="page">Docs</a>');
  });

  it("renders AGENTS.md, the skill and its references", async () => {
    const agents = await (await t.request("/docs/agents")).text();
    expect(agents).toContain("<h1>AGENTS.md</h1>");
    expect(agents).toContain('<h2 id="non-negotiables">');
    expect(agents).toContain('<div class="table-wrap"><table>');
    expect(agents).toContain('href="https://github.com/aimantas/sistemele/blob/main/AGENTS.md"');

    const skill = await (await t.request("/docs/skill")).text();
    expect(skill).toContain("npx skills add aimantas/sistemele");
    expect(skill).toContain('href="/docs/skill/mcp"');
    expect((await t.request("/docs/skill/mcp")).status).toBe(200);
    expect((await t.request("/docs/nothing-here")).status).toBe(404);
  });

  it("answers agents with the original Markdown", async () => {
    const response = await t.request("/docs/agents", { headers: { accept: "text/markdown" } });
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("## Non-negotiables");
  });

  it("lists the docs in the sitemap and llms.txt", async () => {
    expect(await (await t.request("/sitemap.xml")).text()).toContain("<loc>http://localhost/docs/agents</loc>");
    expect(await (await t.request("/llms.txt")).text()).toContain("- [AGENTS.md](http://localhost/docs/agents)");
  });
});

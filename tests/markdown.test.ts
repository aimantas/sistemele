import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { excerpt, Markdown, markdownText, safeHref, safeImageSrc } from "@/modules/content/shared/markdown";

const html = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));

describe("markdown", () => {
  it("renders headings, paragraphs, emphasis, code and links", () => {
    expect(html("# Title\n\n## Sub\n\n### Small")).toBe('<h2 id="title">Title</h2><h2 id="sub">Sub</h2><h3 id="small">Small</h3>');
    expect(html("A **bold**, *italic*, ~~gone~~ and `code` line.")).toBe("<p>A <strong>bold</strong>, <em>italic</em>, <del>gone</del> and <code>code</code> line.</p>");
    expect(html("***both***")).toBe("<p><strong><em>both</em></strong></p>");
    expect(html("*a **b** c*")).toBe("<p><em>a <strong>b</strong> c</em></p>");
    expect(html("snake_case_name stays")).toBe("<p>snake_case_name stays</p>");
    expect(html("[Products](/products) and [site](https://example.com \"Title\")")).toBe('<p><a href="/products">Products</a> and <a href="https://example.com" title="Title">site</a></p>');
    expect(html("See https://example.com/a_b. Or <mailto:hi@example.com>")).toBe('<p>See <a href="https://example.com/a_b">https://example.com/a_b</a>. Or <a href="mailto:hi@example.com">hi@example.com</a></p>');
  });

  it("allows balanced parentheses in link addresses", () => {
    expect(html("[Gate](https://en.wikipedia.org/wiki/Gate_(fence)).")).toBe('<p><a href="https://en.wikipedia.org/wiki/Gate_(fence)">Gate</a>.</p>');
  });

  it("keeps single line breaks and splits paragraphs on blank lines", () => {
    expect(html("one\ntwo\n\nthree")).toBe("<p>one<br/>two</p><p>three</p>");
  });

  it("renders lists, nested lists, quotes, rules and code blocks", () => {
    expect(html("- a\n- b\n  - c\n\n1. one\n2. two")).toBe("<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><ol><li>one</li><li>two</li></ol>");
    expect(html("3. three\n4. four")).toBe('<ol start="3"><li>three</li><li>four</li></ol>');
    expect(html("- a\n\n- b")).toBe("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
    expect(html("> quoted\n> text\n\n---")).toBe("<blockquote><p>quoted<br/>text</p></blockquote><hr/>");
    expect(html("```js\nconst a = '<b>';\n```")).toBe('<pre><code class="language-js">const a = &#x27;&lt;b&gt;&#x27;;</code></pre>');
    expect(html("2024. was a good year")).toBe('<ol start="2024"><li>was a good year</li></ol>');
    expect(html("We grew in\n2024. It was good")).toBe("<p>We grew in<br/>2024. It was good</p>");
  });

  it("never renders HTML from the source", () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n**<b>x</b>**');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("drops unsafe link and image targets", () => {
    expect(html("[click](javascript:alert(1))")).toBe("<p>click</p>");
    expect(html("[click](JaVaScRiPt:alert)")).toBe("<p>click</p>");
    expect(html("[click](data:text/html;base64,xx)")).toBe("<p>click</p>");
    expect(html("![pic](http://example.com/a.png)")).toBe("<p>pic</p>");
    expect(html("![pic](https://example.com/a.png)")).toBe('<p><img src="https://example.com/a.png" alt="pic" loading="lazy" decoding="async"/></p>');
    expect(safeHref(" java\u0001script:x")).toBeNull();
    expect(safeHref("tel:+37060000000")).toBe("tel:+37060000000");
    expect(safeHref("#section")).toBe("#section");
    expect(safeImageSrc("//evil.example/x.png")).toBeNull();
    expect(safeImageSrc("/brand/logo.svg")).toBe("/brand/logo.svg");
  });

  it("gives headings unique ids and never reuses the skip-link target", () => {
    expect(html("## Main\n\n## Same\n\n## Same")).toBe('<h2 id="main-2">Main</h2><h2 id="same">Same</h2><h2 id="same-2">Same</h2>');
  });

  it("extracts plain text for summaries", () => {
    expect(markdownText("## Hello\n\nA [link](/x) and **bold**.\n\n- one\n- two")).toBe("Hello A link and bold. one two");
    expect(excerpt("word ".repeat(100), 20)).toBe("word word word word…");
  });

  it("stays fast on hostile input", () => {
    const started = performance.now();
    for (const source of ["*a ".repeat(30_000), "[".repeat(50_000), "`".repeat(40_000), "_x ".repeat(30_000), "> ".repeat(5_000) + "deep", "- ".repeat(5_000) + "deep", "~~".repeat(30_000)]) {
      markdownText(source);
    }
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

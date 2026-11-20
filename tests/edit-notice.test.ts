import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers";

let dev: TestApp;
let live: TestApp;

beforeAll(async () => {
  dev = await createTestApp();
  live = await createTestApp({ env: { APP_ENV: "production" } });
});
afterAll(async () => {
  await dev.dispose();
  await live.dispose();
});

describe("Edit this page", () => {
  it("shows where a page comes from in local development", async () => {
    const privacy = await (await dev.request("/privacy")).text();
    expect(privacy).toContain('<p id="edit-notice-title" class="edit-title">Edit this page</p>');
    expect(privacy).toContain('href="https://github.com/aimantas/sistemele/blob/main/src/worker/site/pages.tsx"');
    expect(privacy).toContain('href="https://github.com/aimantas/sistemele/tree/main/src/worker/site"');

    const docs = await (await dev.request("/docs/agents")).text();
    expect(docs).toContain('href="https://github.com/aimantas/sistemele/blob/main/AGENTS.md"><code>AGENTS.md</code></a>');

    const products = await (await dev.request("/products")).text();
    expect(products).toContain('<a class="button" href="/app/catalog/products">Catalog → Products</a>');
  });

  it("never shows on a live site", async () => {
    for (const path of ["/", "/privacy", "/contact", "/products", "/docs"]) {
      const html = await (await live.request(path)).text();
      expect(html, path).not.toContain("edit-notice");
    }
  });
});

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers";

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.dispose());

describe("starter home screenshots", () => {
  it("open full size in a lightbox without JavaScript, and every image exists", async () => {
    const html = await (await t.request("/")).text();
    const targets = [...html.matchAll(/popoverTarget="(shot-[a-z]+)"/giu)].map((match) => match[1]);
    const popovers = [...html.matchAll(/<div id="(shot-[a-z]+)" popover="auto" class="lightbox"/gu)].map((match) => match[1]);
    // The hero, four feature shots and the six-screen gallery.
    expect(popovers.length).toBe(11);
    for (const id of popovers) expect(targets.filter((target) => target === id).length, id).toBe(2); // open and close
    // Only structured data, no JavaScript.
    expect(html.match(/<script(?![^>]*application\/ld\+json)/gu)).toBeNull();
    for (const id of popovers) expect(existsSync(resolve(import.meta.dirname, "..", "public/screenshots", `${id.slice(5)}.webp`)), id).toBe(true);
    expect(html).toContain('<h3 id="more-screens">More screens</h3>');
  });
});

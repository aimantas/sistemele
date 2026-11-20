import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The admin panel (Tailwind) and the public site (plain CSS, inlined) share
// one set of shadcn/ui tokens. The site keeps a copy between the
// tokens:start/end markers; this test keeps the copy honest.

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "src/app/styles.css"), "utf8");
const site = readFileSync(resolve(root, "src/worker/site/styles.css"), "utf8");

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(match[1], match[2].trim());
  return out;
}

const block = (css: string, selector: RegExp) => declarations(selector.exec(css)?.[1] ?? "");

const siteBlock = /\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//.exec(site)?.[1] ?? "";
const appLight = block(app, /:root\s*\{([^}]*)\}/);
const appDark = block(app, /\n\.dark\s*\{([^}]*)\}/);
const siteLight = block(siteBlock, /:root\s*\{([^}]*)\}/);

const REQUIRED = ["--background", "--foreground", "--card", "--primary", "--primary-foreground", "--muted", "--muted-foreground", "--accent", "--destructive", "--border", "--input", "--success", "--warning", "--info"];

describe("design tokens", () => {
  it("the site has a marked token block", () => {
    expect(siteBlock.length).toBeGreaterThan(0);
  });

  it("site tokens match the admin panel's light tokens", () => {
    for (const name of REQUIRED) expect(siteLight.has(name), `${name} missing on the site`).toBe(true);
    for (const [name, value] of siteLight) expect(appLight.get(name), name).toBe(value);
  });

  it("is light by default: dark is a class, never the system setting", () => {
    for (const name of REQUIRED) expect(appDark.has(name), `.dark ${name}`).toBe(true);
    expect(app).not.toContain("prefers-color-scheme");
    expect(site).not.toContain("prefers-color-scheme");
    expect(site).toContain("color-scheme: light;");
  });

  it("components use token classes, not the pre-shadcn names", () => {
    const legacy = /\b(?:bg|text|border|ring|divide)-(?:paper|surface|sunken|ink|ink-soft|line|line-strong|brand|brand-hover|brand-soft|brand-ink|danger)\b/;
    const files = ["src/app", "src/modules"].flatMap((dir) =>
      readdirSync(resolve(root, dir), { recursive: true, encoding: "utf8" })
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => resolve(root, dir, file)),
    );
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((file) => legacy.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

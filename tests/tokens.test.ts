import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The admin panel (Tailwind) and the public site (plain CSS, inlined) share
// one set of shadcn/ui tokens. The site keeps a copy between the
// tokens:start/end markers; this test keeps the copy honest.

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "src/app/styles.css"), "utf8");
const site = readFileSync(resolve(root, "src/worker/site/styles.css"), "utf8");

type Tokens = { light: Map<string, string>; dark: Map<string, string> };

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(match[1], match[2].trim());
  return out;
}

/** Light tokens from the first `:root {…}`, dark tokens from the dark media query. */
function tokens(css: string): Tokens {
  const light = /:root\s*\{([^}]*)\}/.exec(css);
  const dark = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css);
  if (!light || !dark) throw new Error("Token blocks not found.");
  return { light: declarations(light[1]), dark: declarations(dark[1]) };
}

const siteBlock = /\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//.exec(site)?.[1] ?? "";
const appTokens = tokens(app);
const siteTokens = tokens(siteBlock);

const REQUIRED = ["--background", "--foreground", "--card", "--primary", "--primary-foreground", "--muted", "--muted-foreground", "--accent", "--destructive", "--border", "--input", "--success", "--warning", "--info"];

describe("design tokens", () => {
  it("the site has a marked token block", () => {
    expect(siteBlock.length).toBeGreaterThan(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`site ${scheme} tokens match the admin panel`, () => {
      for (const name of REQUIRED) expect(siteTokens[scheme].has(name), `${scheme} ${name} missing on the site`).toBe(true);
      for (const [name, value] of siteTokens[scheme]) {
        expect(appTokens[scheme].get(name), `${scheme} ${name}`).toBe(value);
      }
    });
  }

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

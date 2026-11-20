import { Hono } from "hono";
import { themeCss, type BrandInfo } from "@/shared/branding";
import { getContext } from "../context";
import type { AppEnv } from "../env";
import { sha256Hex } from "../lib/crypto";
import { getBranding } from "../lib/settings";

/** Short content hash used to bust caches when the logo changes. */
export async function logoVersion(svg: string): Promise<string> {
  return (await sha256Hex(svg)).slice(0, 12);
}

export async function logoUrl(svg: string | null): Promise<string | null> {
  return svg ? `/brand/logo.svg?v=${await logoVersion(svg)}` : null;
}

/**
 * Public brand assets: the logo, the dashboard theme stylesheet and brand info
 * for the sign-in page. Nothing here needs sign-in; it is all shown publicly.
 */
export const brandRoutes = new Hono<AppEnv>()
  .get("/brand/logo.svg", async (c) => {
    const { logoSvg } = await getBranding(getContext(c).db);
    if (!logoSvg) return c.body("No logo", 404, { "Content-Type": "text/plain; charset=utf-8" });
    const etag = `"${await logoVersion(logoSvg)}"`;
    const headers = {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Opened directly, the SVG still cannot run code or load anything.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      "Cache-Control": c.req.query("v") ? "public, max-age=31536000, immutable" : "public, max-age=300",
      ETag: etag,
    };
    if (c.req.header("if-none-match") === etag) return c.body(null, 304, headers);
    return c.body(logoSvg, 200, headers);
  })
  .get("/brand/theme", async (c) => {
    const css = themeCss(await getBranding(getContext(c).db));
    const etag = `"${(await sha256Hex(css)).slice(0, 12)}"`;
    const headers = { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-cache", ETag: etag };
    if (c.req.header("if-none-match") === etag) return c.body(null, 304, headers);
    return c.body(css, 200, headers);
  })
  .get("/brand/info.json", async (c) => {
    const ctx = getContext(c);
    const [branding, business] = await Promise.all([getBranding(ctx.db), ctx.business()]);
    const info: BrandInfo = { name: business.name, logoUrl: await logoUrl(branding.logoSvg), brandColor: branding.brandColor };
    return c.json(info, 200, { "Cache-Control": "no-cache" });
  });

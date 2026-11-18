import { z } from "zod";

/**
 * Brand settings (Settings → Brand), stored under settings key "branding".
 * One brand colour drives every accent; hover, soft tint and text-on-brand
 * colours are derived so the palette stays consistent and readable.
 */

export const SURFACES = {
  warm: { label: "Warm paper", paper: "#f6f5f1", sunken: "#efeee9", line: "#e2e1dc", lineStrong: "#c4c3bc" },
  cool: { label: "Cool grey", paper: "#f4f6f8", sunken: "#eceff3", line: "#dfe3e8", lineStrong: "#c3c9d1" },
  white: { label: "Plain white", paper: "#fafafa", sunken: "#f1f1f1", line: "#e6e6e6", lineStrong: "#cccccc" },
} as const;

export const CORNERS = {
  sharp: { label: "Sharp", control: "2px", panel: "4px" },
  soft: { label: "Soft", control: "8px", panel: "12px" },
  round: { label: "Round", control: "12px", panel: "18px" },
} as const;

export const BRAND_PRESETS = [
  { id: "forest", label: "Forest", color: "#1f5f4a" },
  { id: "ocean", label: "Ocean", color: "#1d5b8f" },
  { id: "graphite", label: "Graphite", color: "#2b3036" },
  { id: "terracotta", label: "Terracotta", color: "#a3472b" },
  { id: "plum", label: "Plum", color: "#6b3d7a" },
  { id: "amber", label: "Amber", color: "#8a5a00" },
] as const;

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/u, "Use a 6-digit hex colour like #1f5f4a.").transform((value) => value.toLowerCase());

export const brandingSchema = z.object({
  brandColor: hexColor.default("#1f5f4a"),
  surface: z.enum(["warm", "cool", "white"]).default("warm"),
  corners: z.enum(["sharp", "soft", "round"]).default("soft"),
  /** Sanitised SVG markup, or null for the default mark. Max 100 KB. */
  logoSvg: z.string().max(100_000, "The logo must be under 100 KB. Simplify or minify the SVG.").nullable().default(null),
});
export type Branding = z.output<typeof brandingSchema>;
export type BrandingInput = z.input<typeof brandingSchema>;
export const defaultBranding: Branding = brandingSchema.parse({});

/** Public brand info for the dashboard shell and sign-in page (GET /brand/info.json). */
export interface BrandInfo {
  name: string;
  logoUrl: string | null;
  brandColor: string;
}

// Colour maths (sRGB, WCAG 2.x contrast)

function toRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mixes `a` towards `b` by `amount` (0..1). */
export function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount]);
}

function luminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export interface BrandTokens {
  brand: string;
  brandHover: string;
  brandSoft: string;
  brandInk: string;
  paper: string;
  sunken: string;
  line: string;
  lineStrong: string;
  radiusControl: string;
  radiusPanel: string;
  /** Contrast of the brand colour against white text and as text on white. */
  contrast: { onBrand: number; asText: number };
}

export function brandTokens(branding: Branding): BrandTokens {
  const brand = branding.brandColor;
  const surface = SURFACES[branding.surface];
  const corners = CORNERS[branding.corners];
  const onWhite = contrastRatio(brand, "#ffffff");
  const brandInk = onWhite >= 4.5 || onWhite >= contrastRatio(brand, "#111111") ? "#ffffff" : "#111111";
  return {
    brand,
    brandHover: mix(brand, "#000000", 0.18),
    brandSoft: mix(brand, "#ffffff", 0.88),
    brandInk,
    paper: surface.paper,
    sunken: surface.sunken,
    line: surface.line,
    lineStrong: surface.lineStrong,
    radiusControl: corners.control,
    radiusPanel: corners.panel,
    contrast: { onBrand: contrastRatio(brand, brandInk), asText: onWhite },
  };
}

/** CSS for the dashboard: overrides the Tailwind @theme variables. */
export function dashboardThemeCss(branding: Branding): string {
  const t = brandTokens(branding);
  return `:root:root{--color-brand:${t.brand};--color-brand-hover:${t.brandHover};--color-brand-soft:${t.brandSoft};--color-brand-ink:${t.brandInk};--color-paper:${t.paper};--color-sunken:${t.sunken};--color-line:${t.line};--color-line-strong:${t.lineStrong};--radius-control:${t.radiusControl};--radius-panel:${t.radiusPanel};}`;
}

/** CSS for the public site: overrides the variables at the top of site/styles.css. */
export function siteThemeCss(branding: Branding): string {
  const t = brandTokens(branding);
  return `:root{--brand:${t.brand};--brand-ink:${t.brandInk};--brand-soft:${t.brandSoft};--paper:${t.paper};--line:${t.line};--radius:${t.radiusPanel};}`;
}

import { z } from "zod";

/**
 * Brand settings (Settings → Brand), stored under settings key "branding".
 * One brand colour drives every accent; hover, soft tint and text-on-brand
 * colours are derived so the palette stays consistent and readable.
 */

/** Light-mode surfaces. Dark mode keeps its own neutral surfaces (src/app/styles.css). */
export const SURFACES = {
  cool: { label: "Cool grey", background: "#f8f9fb", muted: "#f1f3f6", sidebar: "#f4f5f8", border: "#e3e6eb", input: "#d3d8df" },
  warm: { label: "Warm paper", background: "#f8f7f4", muted: "#f0efea", sidebar: "#f3f2ee", border: "#e6e4de", input: "#d6d3cb" },
  white: { label: "Plain white", background: "#ffffff", muted: "#f4f4f5", sidebar: "#fafafa", border: "#e6e6e9", input: "#d4d4d8" },
} as const;

/** The base --radius; controls use it minus 2px, cards plus 4px (shadcn scale). */
export const CORNERS = {
  sharp: { label: "Sharp", radius: "0.25rem" },
  soft: { label: "Soft", radius: "0.625rem" },
  round: { label: "Round", radius: "1rem" },
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
  surface: z.enum(["cool", "warm", "white"]).default("cool"),
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
  /** True when the logo is a square mark: show the business name beside it. */
  logoMark: boolean;
  brandColor: string;
}

/**
 * A logo whose viewBox (or width and height) is roughly square is a mark,
 * not a full logo: headers set the business name next to it. Wide logos
 * already carry the name and show alone.
 */
export function logoIsMark(svg: string | null): boolean {
  if (!svg) return false;
  const viewBox = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/iu.exec(svg);
  const width = viewBox?.[1] ?? /\swidth=["']([\d.]+)/iu.exec(svg)?.[1];
  const height = viewBox?.[2] ?? /\sheight=["']([\d.]+)/iu.exec(svg)?.[1];
  const ratio = Number(width) / Number(height);
  return Number.isFinite(ratio) && ratio > 0.75 && ratio < 1.34;
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

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/**
 * The brand for dark surfaces: same hue and saturation, lighter until it reads
 * as text and as an active fill (5:1 on the dark ground). Mixing with white
 * would grey it out and make the primary button look disabled.
 */
export function brandForDark(brand: string): string {
  const [h, s, l] = toHsl(brand);
  let lightness = l;
  let candidate = brand;
  while (contrastRatio(candidate, DARK_SURFACE) < 5 && lightness < 0.9) {
    lightness += 0.02;
    candidate = fromHsl([h, s, lightness]);
  }
  return candidate;
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
  /** Light mode: the brand colour and the text colour on it. */
  brand: string;
  brandHover: string;
  brandSoft: string;
  brandInk: string;
  /** Dark mode: the brand lightened for dark surfaces, and the text on it. */
  brandDark: string;
  brandDarkInk: string;
  background: string;
  muted: string;
  sidebar: string;
  border: string;
  input: string;
  radius: string;
  /** Contrast of the brand colour against white text and as text on white. */
  contrast: { onBrand: number; asText: number };
}

const DARK_SURFACE = "#0f1013";

/** The text colour with the better contrast on `background`: white or near-black. */
function inkOn(background: string): string {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111111") ? "#ffffff" : "#111111";
}

export function brandTokens(branding: Branding): BrandTokens {
  const brand = branding.brandColor;
  const surface = SURFACES[branding.surface];
  const onWhite = contrastRatio(brand, "#ffffff");
  const brandInk = onWhite >= 4.5 || onWhite >= contrastRatio(brand, "#111111") ? "#ffffff" : "#111111";
  // On dark surfaces the brand must read as text (links, focus) as well as a fill.
  const brandDark = brandForDark(brand);
  return {
    brand,
    brandHover: mix(brand, "#000000", 0.18),
    brandSoft: mix(brand, "#ffffff", 0.9),
    brandInk,
    brandDark,
    brandDarkInk: inkOn(brandDark),
    background: surface.background,
    muted: surface.muted,
    sidebar: surface.sidebar,
    border: surface.border,
    input: surface.input,
    radius: CORNERS[branding.corners].radius,
    contrast: { onBrand: contrastRatio(brand, brandInk), asText: onWhite },
  };
}

/**
 * Theme overrides for the admin panel and the public site (same shadcn token
 * names). Light is the default everywhere; the admin panel switches to dark
 * with the `.dark` class on <html>. Light overrides skip `.dark`, so dark
 * mode keeps its own neutral surfaces; the brand colour is adjusted for it.
 */
export function themeCss(branding: Branding): string {
  const t = brandTokens(branding);
  const light = `--primary:${t.brand};--primary-foreground:${t.brandInk};--background:${t.background};--muted:${t.muted};--secondary:${t.muted};--accent:${t.muted};--sidebar:${t.sidebar};--sidebar-accent:${t.border};--border:${t.border};--sidebar-border:${t.border};--input:${t.input};`;
  const dark = `--primary:${t.brandDark};--primary-foreground:${t.brandDarkInk};`;
  return `:root:root{--radius:${t.radius};}:root:root:not(.dark){${light}}:root:root.dark{${dark}}`;
}

const TRANSLITERATION: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i", ħ: "h", ŧ: "t" };

/** A valid URL slug: lowercase letters, digits and single hyphens, e.g. "about-us". */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * URL slug from a name: lowercase ASCII, accents removed (ą→a, č→c, ė→e, š→s,
 * ū→u, ž→z …), anything else becomes "-", at most 80 characters. Returns
 * `fallback` when nothing is left.
 */
export function slugify(value: string, fallback = "item"): string {
  const ascii = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[ßæœøłđðþıħŧ]/gu, (char) => TRANSLITERATION[char] ?? "");
  const slug = ascii.replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  const trimmed = slug.length > 80 ? slug.slice(0, 80).replace(/-[^-]*$/u, "") || slug.slice(0, 80) : slug;
  return trimmed || fallback;
}

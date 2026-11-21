import { badRequest } from "./errors";

/**
 * Cleans pasted SVG logo markup. Logos are only ever displayed through <img>
 * (where scripts never run) and served with a sandboxing CSP; this removes
 * active content anyway as a second layer: scripts, event handlers,
 * foreignObject, external references and javascript: URLs.
 */
export function sanitizeSvg(input: string): string {
  let svg = input.trim().replace(/^\uFEFF/u, "");
  svg = svg.replace(/^<\?xml[^>]*>\s*/iu, "").replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/giu, "").replace(/<!--[\s\S]*?-->/gu, "").trim();
  if (!/^<svg[\s>]/iu.test(svg) || !/<\/svg>$/iu.test(svg)) {
    throw badRequest("Paste a complete SVG that starts with <svg and ends with </svg>.", { logoSvg: "Paste a complete SVG that starts with <svg and ends with </svg>." });
  }
  // Refuse what stripping cannot handle reliably: namespaced elements
  // (<s:script>), namespaced attributes other than xmlns:* and xlink:href,
  // character references inside attributes (&#106;avascript:), CSS @import
  // and CDATA sections. Plain logos from design tools never need them.
  const unsafe =
    /<\/?[\w.-]+:[\w.-]+/u.test(svg) ||
    /\s(?!xmlns:|xlink:href\b|xml:)[\w.-]+:[\w.-]+\s*=/u.test(svg) ||
    /=\s*("|')[^"']*&(#|[a-z]+;)[^"']*\1/iu.test(svg) ||
    /@import/iu.test(svg) ||
    /<!\[CDATA\[/u.test(svg);
  if (unsafe) {
    const message = "This SVG uses features a logo does not need (namespaced elements, encoded attributes, @import or CDATA). Export it again as plain SVG.";
    throw badRequest(message, { logoSvg: message });
  }
  svg = svg
    .replace(/<script\b[\s\S]*?<\/script\s*>/giu, "")
    .replace(/<script\b[^>]*\/>/giu, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/giu, "")
    .replace(/<(iframe|embed|object|audio|video|animate|set)\b[\s\S]*?(<\/\1\s*>|\/>)/giu, "")
    .replace(/\son[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/giu, "")
    // Keep only internal (#id) and inline image references.
    .replace(/\s(?:xlink:)?href\s*=\s*("|')(?!#|data:image\/(?:png|jpe?g|gif|webp);base64,)[^"']*\1/giu, "")
    .replace(/javascript:/giu, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/giu, "none");
  if (!/^<svg[\s>]/iu.test(svg)) throw badRequest("The SVG could not be read.");
  if (!/\sxmlns\s*=/iu.test(svg.slice(0, svg.indexOf(">")))) svg = svg.replace(/^<svg/iu, '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}

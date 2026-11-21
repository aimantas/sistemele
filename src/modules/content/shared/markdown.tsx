import type { ReactNode } from "react";
import { slugify } from "@/shared/slug";

/**
 * Safe Markdown for pages and posts, used by the public site (server
 * rendering) and the editor preview (browser). The text is parsed into a
 * small tree and rendered as React elements, so HTML in the source is shown as
 * text, never run, and only http(s), mailto and tel links (plus paths on this
 * site) become links.
 *
 * Supported: headings (# … ####; the entry title is the page's h1, so # and ##
 * both render as h2), paragraphs (a single line break is kept), **bold**,
 * *italic*, ~~strikethrough~~, `code`, fenced code blocks, [links](https://…),
 * ![images](https://… "title"), bare https:// links, bulleted and numbered
 * lists (nested by indenting two spaces), > quotes and --- rules.
 * Not supported: raw HTML, tables, footnotes.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "code"; text: string }
  | { type: "strong" | "em" | "del"; children: Inline[] }
  | { type: "link"; href: string; title?: string; children: Inline[] }
  | { type: "image"; src: string; alt: string; title?: string };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; start: number; loose: boolean; items: Block[][] }
  | { type: "quote"; children: Block[] }
  | { type: "code"; language: string; text: string }
  | { type: "rule" };

/** Nesting limit for quotes, lists and emphasis; deeper text stays plain. */
const MAX_DEPTH = 8;
/** Longest link text and address the parser looks at, which keeps it linear on hostile input. */
const MAX_LABEL = 500;
const MAX_URL = 2000;

// URLs

const LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** A link target that is safe to put in href, or null. Relative paths and #anchors are allowed. */
export function safeHref(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  // Browsers ignore control characters and spaces when reading a scheme ("java\tscript:"), so check without them.
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000- \u007f-\u009f]/gu, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(compact);
  if (scheme) return LINK_SCHEMES.has(scheme[1].toLowerCase()) ? value : null;
  return value;
}

/** An image source that is safe to load: an https:// address or a path on this site. */
export function safeImageSrc(url: string): string | null {
  const value = url.trim();
  if (/^https:\/\/\S+$/iu.test(value)) return value;
  if (/^\/(?!\/)\S*$/u.test(value)) return value;
  return null;
}

// Blocks

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)[^`]*$/u;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/u;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/u;
const QUOTE = /^ {0,3}>[ ]?(.*)$/u;

interface ListMarker {
  ordered: boolean;
  /** "-", "*", "+" for bullets; "." or ")" for numbers. Items with another marker start a new list. */
  delimiter: string;
  number: number;
  content: string;
  /** Columns before the item text; continuation lines are dedented by up to this much. */
  width: number;
}

function listMarker(line: string): ListMarker | null {
  const bullet = /^( {0,3})([-*+])( +)(.*)$/u.exec(line);
  if (bullet) return { ordered: false, delimiter: bullet[2], number: 1, content: bullet[4], width: bullet[1].length + 1 + bullet[3].length };
  const numbered = /^( {0,3})(\d{1,9})([.)])( +)(.*)$/u.exec(line);
  if (numbered) return { ordered: true, delimiter: numbered[3], number: Number(numbered[2]), content: numbered[5], width: numbered[1].length + numbered[2].length + 1 + numbered[4].length };
  return null;
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/** True when the line starts a block that ends a running paragraph. */
function interruptsParagraph(line: string): boolean {
  if (FENCE.test(line) || RULE.test(line) || QUOTE.test(line)) return true;
  const heading = HEADING.exec(line);
  if (heading && heading[2]?.trim()) return true;
  const marker = listMarker(line);
  // Only "1." may interrupt a paragraph, so "2024. was a good year" stays text.
  return Boolean(marker && marker.content.trim() && (!marker.ordered || marker.number === 1));
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/gu, "\n").replace(/\t/gu, "    ").split("\n");
  return parseBlocks(lines, 0);
}

function parseBlocks(lines: string[], depth: number): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[1][0] === "`" ? "`" : "~"}{${fence[1].length},}[ \\t]*$`, "u");
      const code: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ type: "code", language: fence[2] ?? "", text: code.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading && heading[2]?.trim()) {
      const level = Math.min(Math.max(heading[1].length, 2), 4) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, children: parseInline(heading[2].trim(), depth) });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      for (; i < lines.length && lines[i].trim() && QUOTE.test(lines[i]); i++) inner.push(QUOTE.exec(lines[i])![1]);
      blocks.push(depth < MAX_DEPTH ? { type: "quote", children: parseBlocks(inner, depth + 1) } : { type: "paragraph", children: parseInline(inner.join("\n"), depth) });
      continue;
    }

    const marker = listMarker(line);
    if (marker && marker.content.trim()) {
      const [list, next] = parseList(lines, i, marker, depth);
      blocks.push(list);
      i = next;
      continue;
    }

    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !interruptsParagraph(lines[i])) paragraph.push(lines[i++]);
    blocks.push({ type: "paragraph", children: parseInline(paragraph.map((part) => part.trim()).join("\n"), depth) });
  }
  return blocks;
}

function parseList(lines: string[], start: number, first: ListMarker, depth: number): [Block, number] {
  const items: Block[][] = [];
  let loose = false;
  let i = start;

  while (i < lines.length) {
    // Blank lines between items keep the list going (and make it "loose").
    let next = i;
    while (next < lines.length && !lines[next].trim()) next++;
    const marker = next < lines.length ? listMarker(lines[next]) : null;
    if (!marker || !marker.content.trim() || marker.ordered !== first.ordered || marker.delimiter !== first.delimiter) break;
    if (next > i) loose = true;

    const itemLines = [marker.content];
    let blankInside = false;
    i = next + 1;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        let after = i;
        while (after < lines.length && !lines[after].trim()) after++;
        if (after < lines.length && indentOf(lines[after]) >= 2) {
          for (; i < after; i++) itemLines.push("");
          blankInside = true;
          continue;
        }
        break;
      }
      const indent = indentOf(line);
      if (indent >= 2) {
        itemLines.push(line.slice(Math.min(indent, marker.width)));
        i++;
        continue;
      }
      // A wrapped line without indentation continues the item's text; a new marker starts the next item.
      if (!blankInside && !listMarker(line) && !interruptsParagraph(line)) {
        itemLines.push(line.trim());
        i++;
        continue;
      }
      break;
    }
    if (blankInside) loose = true;
    items.push(depth < MAX_DEPTH ? parseBlocks(itemLines, depth + 1) : [{ type: "paragraph", children: parseInline(itemLines.join("\n"), depth) }]);
  }

  return [{ type: "list", ordered: first.ordered, start: first.number, loose, items }, i];
}

// Inline

const ESCAPABLE = /[!-/:-@[-`{-~]/u;
const WORD = /[\p{L}\p{N}]/u;
const BARE_URL = /^https?:\/\/[^\s<>"]+/u;
const AUTOLINK = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/u;

/**
 * Closing position of a `size`-character `char` delimiter (emphasis), or -1.
 * A run of three closes both ** and *; `_` only counts at word edges.
 */
function findCloser(text: string, from: number, size: 1 | 2, char: string): number {
  let at = text.indexOf(char, from);
  while (at >= 0) {
    let runEnd = at;
    while (text[runEnd] === char) runEnd++;
    const run = runEnd - at;
    const candidate = runEnd - size;
    if ((run === size || run >= 3) && candidate > from) {
      const before = text[candidate - 1];
      const after = text[runEnd];
      if (!/\s/u.test(before) && (char !== "_" || after === undefined || !WORD.test(after))) return candidate;
    }
    at = text.indexOf(char, runEnd);
  }
  return -1;
}

interface LinkMatch {
  label: string;
  url: string;
  title?: string;
  end: number;
}

/** `[label](url "title")` starting at `open` (the "["), or null. */
function matchLink(text: string, open: number): LinkMatch | null {
  let level = 0;
  let close = -1;
  const limit = Math.min(text.length, open + MAX_LABEL);
  for (let j = open; j < limit; j++) {
    const char = text[j];
    if (char === "\\") j++;
    else if (char === "[") level++;
    else if (char === "]" && --level === 0) {
      close = j;
      break;
    }
  }
  if (close < 0 || text[close + 1] !== "(") return null;
  const destination = matchDestination(text, close + 1);
  return destination ? { label: text.slice(open + 1, close), ...destination } : null;
}

/** `(url "title")` starting at `open` (the "("). URLs may contain balanced parentheses: /wiki/Gate_(fence). */
function matchDestination(text: string, open: number): { url: string; title?: string; end: number } | null {
  const limit = Math.min(text.length, open + MAX_URL);
  let j = open + 1;
  while (j < limit && text[j] === " ") j++;
  let url: string;
  if (text[j] === "<") {
    const end = text.indexOf(">", j);
    if (end < 0 || end >= limit || text.slice(j, end).includes("\n")) return null;
    url = text.slice(j + 1, end);
    j = end + 1;
  } else {
    const start = j;
    let level = 0;
    for (; j < limit; j++) {
      const char = text[j];
      if (/\s/u.test(char)) break;
      if (char === "(") level++;
      else if (char === ")") {
        if (level === 0) break;
        level--;
      }
    }
    url = text.slice(start, j);
  }
  let title: string | undefined;
  const titled = /^\s+"([^"]*)"/u.exec(text.slice(j, limit));
  if (titled) {
    title = titled[1];
    j += titled[0].length;
  }
  while (j < limit && text[j] === " ") j++;
  return text[j] === ")" ? { url, ...(title ? { title } : {}), end: j + 1 } : null;
}

function parseInline(text: string, depth: number, inLink = false): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };
  const lineBreak = () => {
    buffer = buffer.replace(/[ \t]+$/u, "");
    flush();
    out.push({ type: "break" });
  };
  /** Delimiters known to have no closer further on (keeps hostile input linear). */
  const unmatched = new Set<string>();

  let i = 0;
  while (i < text.length) {
    const char = text[i];

    if (char === "\\" && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === "\n") {
        lineBreak();
        i += 2;
        continue;
      }
      if (ESCAPABLE.test(next)) {
        buffer += next;
        i += 2;
        continue;
      }
    }

    if (char === "\n") {
      lineBreak();
      i++;
      continue;
    }

    if (char === "`") {
      let runEnd = i;
      while (text[runEnd] === "`") runEnd++;
      const run = text.slice(i, runEnd);
      if (!unmatched.has(run)) {
        let close = text.indexOf(run, runEnd);
        while (close >= 0 && (text[close + run.length] === "`" || text[close - 1] === "`")) close = text.indexOf(run, close + run.length + 1);
        if (close >= 0) {
          flush();
          let code = text.slice(runEnd, close).replace(/\n/gu, " ");
          if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()) code = code.slice(1, -1);
          out.push({ type: "code", text: code });
          i = close + run.length;
          continue;
        }
        unmatched.add(run);
      }
      buffer += run;
      i = runEnd;
      continue;
    }

    if (char === "!" && text[i + 1] === "[" && !unmatched.has("]")) {
      const link = matchLink(text, i + 1);
      if (link) {
        flush();
        const src = safeImageSrc(link.url);
        if (src) out.push({ type: "image", src, alt: link.label.replace(/\\(.)/gu, "$1"), ...(link.title ? { title: link.title } : {}) });
        else if (link.label) out.push({ type: "text", text: link.label });
        i = link.end;
        continue;
      }
      if (text.indexOf("]", i) < 0) unmatched.add("]");
    }

    if (char === "[" && !inLink && !unmatched.has("]")) {
      const link = matchLink(text, i);
      if (link) {
        flush();
        const children = depth < MAX_DEPTH ? parseInline(link.label, depth + 1, true) : [{ type: "text" as const, text: link.label }];
        const href = safeHref(link.url);
        if (href) out.push({ type: "link", href, ...(link.title ? { title: link.title } : {}), children });
        else out.push(...children);
        i = link.end;
        continue;
      }
      if (text.indexOf("]", i) < 0) unmatched.add("]");
    }

    if (char === "<" && !inLink) {
      const auto = AUTOLINK.exec(text.slice(i, i + MAX_URL));
      if (auto) {
        flush();
        out.push({ type: "link", href: auto[1], children: [{ type: "text", text: auto[1].replace(/^mailto:/iu, "") }] });
        i += auto[0].length;
        continue;
      }
    }

    if (char === "h" && !inLink && (i === 0 || !/[\p{L}\p{N}/]/u.test(text[i - 1]))) {
      const bare = BARE_URL.exec(text.slice(i, i + MAX_URL));
      if (bare) {
        const url = bare[0].replace(/[.,:;!?'")\]*_~]+$/u, "");
        if (url.length > "https://".length) {
          flush();
          out.push({ type: "link", href: url, children: [{ type: "text", text: url }] });
          i += url.length;
          continue;
        }
      }
    }

    if (char === "*" || char === "_" || (char === "~" && text[i + 1] === "~")) {
      const size: 1 | 2 = text[i + 1] === char ? 2 : 1;
      const kind = char === "~" ? "del" : size === 2 ? "strong" : "em";
      const key = `${char}${size}`;
      const after = text[i + size];
      const canOpen = after !== undefined && !/\s/u.test(after) && (char !== "_" || i === 0 || !WORD.test(text[i - 1]));
      if (canOpen && depth < MAX_DEPTH && !unmatched.has(key)) {
        const close = findCloser(text, i + size, size, char);
        if (close >= 0) {
          flush();
          out.push({ type: kind, children: parseInline(text.slice(i + size, close), depth + 1, inLink) });
          i = close + size;
          continue;
        }
        unmatched.add(key);
      }
      // Not emphasis: keep one character and look again from the next one.
      buffer += char;
      i++;
      continue;
    }

    buffer += char;
    i++;
  }
  flush();
  return out;
}

// Plain text

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.text;
        case "break":
          return " ";
        case "image":
          return node.alt;
        default:
          return inlineText(node.children);
      }
    })
    .join("");
}

function blocksText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
          return inlineText(block.children);
        case "list":
          return block.items.map(blocksText).join(" ");
        case "quote":
          return blocksText(block.children);
        case "code":
          return block.text;
        case "rule":
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
}

/** The text of a Markdown document without formatting, whitespace collapsed. */
export function markdownText(source: string): string {
  return blocksText(parseMarkdown(source)).replace(/\s+/gu, " ").trim();
}

/** The first `max` characters of a text, cut at a word boundary. */
export function excerpt(text: string, max = 160): string {
  const value = text.replace(/\s+/gu, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max).replace(/\s+\S*$/u, "")}…`;
}

// React

interface RenderOptions {
  /** Links get rel="nofollow ugc": text written by people the site does not vouch for (public demo visitors). */
  ugc?: boolean;
}

function renderInline(nodes: Inline[], key: string, opts: RenderOptions): ReactNode[] {
  return nodes.map((node, index) => {
    const k = `${key}.${index}`;
    switch (node.type) {
      case "text":
        return node.text;
      case "break":
        return <br key={k} />;
      case "code":
        return <code key={k}>{node.text}</code>;
      case "strong":
        return <strong key={k}>{renderInline(node.children, k, opts)}</strong>;
      case "em":
        return <em key={k}>{renderInline(node.children, k, opts)}</em>;
      case "del":
        return <del key={k}>{renderInline(node.children, k, opts)}</del>;
      case "link":
        return (
          <a key={k} href={node.href} title={node.title} rel={opts.ugc ? "nofollow ugc noopener" : undefined}>
            {renderInline(node.children, k, opts)}
          </a>
        );
      case "image":
        return <img key={k} src={node.src} alt={node.alt} title={node.title} loading="lazy" decoding="async" />;
    }
  });
}

function renderBlocks(blocks: Block[], key: string, ids: Set<string>, opts: RenderOptions): ReactNode[] {
  return blocks.map((block, index) => {
    const k = `${key}.${index}`;
    switch (block.type) {
      case "heading": {
        const Tag = `h${block.level}` as const;
        const base = slugify(inlineText(block.children), "section");
        let id = base;
        for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
        ids.add(id);
        return (
          <Tag key={k} id={id}>
            {renderInline(block.children, k, opts)}
          </Tag>
        );
      }
      case "paragraph":
        return <p key={k}>{renderInline(block.children, k, opts)}</p>;
      case "list": {
        const items = block.items.map((item, itemIndex) => {
          const itemKey = `${k}.${itemIndex}`;
          // Tight lists put the text straight in <li>, without paragraph spacing.
          const content = block.loose ? renderBlocks(item, itemKey, ids, opts) : item.map((child, childIndex) => (child.type === "paragraph" ? renderInline(child.children, `${itemKey}.${childIndex}`, opts) : renderBlocks([child], `${itemKey}.${childIndex}`, ids, opts)));
          return <li key={itemKey}>{content}</li>;
        });
        return block.ordered ? (
          <ol key={k} start={block.start === 1 ? undefined : block.start}>
            {items}
          </ol>
        ) : (
          <ul key={k}>{items}</ul>
        );
      }
      case "quote":
        return <blockquote key={k}>{renderBlocks(block.children, k, ids, opts)}</blockquote>;
      case "code":
        return (
          <pre key={k}>
            <code className={block.language ? `language-${block.language}` : undefined}>{block.text}</code>
          </pre>
        );
      case "rule":
        return <hr key={k} />;
    }
  });
}

/** Renders Markdown as React elements. Wrap it in an element with the `prose` class for spacing. */
export function Markdown({ source, ugc = false }: { source: string; ugc?: boolean }) {
  // "main" is the skip-link target of the public layout; never reuse it as a heading id.
  return <>{renderBlocks(parseMarkdown(source), "md", new Set(["main"]), { ugc })}</>;
}

import { slugify } from "@/shared/slug";

/**
 * Markdown → HTML for the repository's own documentation (AGENTS.md, docs/,
 * the agent skill). The source is trusted repository text, but everything is
 * still escaped: raw HTML in the Markdown shows as text. Supports what the
 * docs use: front matter, headings (with ids), paragraphs, **bold**, *italic*,
 * `code`, fenced code, links and images, nested and task lists, tables,
 * > quotes and rules. Link targets go through `resolveHref` so relative links
 * between docs become /docs pages and other repository paths go to GitHub.
 */

export interface DocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderedDoc {
  title: string;
  /** Front matter keys (the skill's name and description). */
  frontMatter: Record<string, string>;
  headings: DocHeading[];
  html: string;
}

export interface RenderOptions {
  /** Maps a link target from the source to an href (relative links, other docs, GitHub). */
  resolveHref?: (href: string) => string;
  /** Maps an image source to a URL that loads on the site. */
  resolveImage?: (src: string) => string;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value: string) => value.replace(/[&<>"']/gu, (char) => ESCAPES[char]);

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)/u;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/u;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u;
const QUOTE = /^\s{0,3}>\s?/u;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])(\s+)(.*)$/u;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/u;

interface State {
  options: RenderOptions;
  title: string;
  headings: DocHeading[];
  ids: Set<string>;
}

export function renderDocMarkdown(source: string, options: RenderOptions = {}): RenderedDoc {
  const { body, frontMatter } = splitFrontMatter(source.replace(/\r\n?/gu, "\n"));
  const state: State = { options, title: "", headings: [], ids: new Set() };
  const html = renderBlocks(body.split("\n"), state, true);
  return { title: state.title || frontMatter.name || "", frontMatter, headings: state.headings, html };
}

function splitFrontMatter(source: string): { body: string; frontMatter: Record<string, string> } {
  const match = /^---\n([\s\S]*?)\n---\n?/u.exec(source);
  if (!match) return { body: source, frontMatter: {} };
  const frontMatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([\w-]+):\s*(.*)$/u.exec(line);
    if (pair) frontMatter[pair[1]] = pair[2].replace(/^["']|["']$/gu, "");
  }
  return { body: source.slice(match[0].length), frontMatter };
}

// Blocks

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line) || /^\s*\|/u.test(line);
}

function renderBlocks(lines: string[], state: State, topLevel = false): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const [, indent, marker, language] = fence;
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(marker)) {
        code.push(lines[i].startsWith(indent) ? lines[i].slice(indent.length) : lines[i].trimStart());
        i++;
      }
      i++;
      out.push(`<pre class="code"${language ? ` data-lang="${escapeHtml(language)}"` : ""}><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      i++;
      const text = heading[2];
      if (heading[1].length === 1 && topLevel && !state.title) {
        state.title = stripInline(text);
        continue;
      }
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4;
      const id = uniqueId(stripInline(text), state);
      if (level < 4) state.headings.push({ id, text: stripInline(text), level: level as 2 | 3 });
      out.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inline(text, state)}</h${level}>`);
      continue;
    }

    if (RULE.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (/^\s*\|/u.test(line) && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const rows: string[][] = [cells(line)];
      i += 2;
      while (i < lines.length && /^\s*\|/u.test(lines[i])) rows.push(cells(lines[i++]));
      const [head, ...body] = rows;
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inline(cell, state)}</th>`).join("")}</tr></thead><tbody>${body
          .map((row) => `<tr>${head.map((_, index) => `<td>${inline(row[index] ?? "", state)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].trim() && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ""));
      out.push(`<blockquote>${renderBlocks(quoted, state)}</blockquote>`);
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const result = renderList(lines, i, state);
      out.push(result.html);
      i = result.next;
      continue;
    }

    const paragraph: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(lines[i++].trim());
    out.push(`<p>${inline(paragraph.join(" "), state)}</p>`);
  }
  return out.join("\n");
}

function renderList(lines: string[], start: number, state: State): { html: string; next: number } {
  const first = LIST_ITEM.exec(lines[start])!;
  const indent = first[1].length;
  const ordered = /\d/u.test(first[2]);
  const items: string[][] = [];
  let loose = false;
  let i = start;

  while (i < lines.length) {
    const match = LIST_ITEM.exec(lines[i]);
    if (!match || match[1].length !== indent || /\d/u.test(match[2]) !== ordered) break;
    const offset = match[1].length + match[2].length + match[3].length;
    const content = [match[4]];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) {
        // A blank line continues the item only if indented content follows.
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && leading(lines[j]) >= offset) {
          loose = true;
          content.push(...lines.slice(i, j).map(() => ""));
          i = j;
          continue;
        }
        if (j < lines.length && LIST_ITEM.test(lines[j]) && leading(lines[j]) === indent) loose = true;
        i = j;
        break;
      }
      if (leading(next) >= offset) content.push(next.slice(offset));
      else if (!startsBlock(next)) content.push(next.trim());
      else break;
      i++;
    }
    items.push(content);
  }

  const tag = ordered ? "ol" : "ul";
  const startNumber = ordered ? Number.parseInt(first[2], 10) : 1;
  const html = items
    .map((content) => {
      const task = /^\[([ xX])\]\s+/u.exec(content[0]);
      if (task) content[0] = content[0].slice(task[0].length);
      const box = task ? `<input type="checkbox" disabled${task[1] === " " ? "" : " checked"} /> ` : "";
      const single = content.length === 1 || content.slice(1).every((line) => !line.trim());
      const body = single && !loose && !startsBlock(content[0]) ? inline(content[0], state) : renderBlocks(content, state);
      return `<li${task ? ' class="task"' : ""}>${box}${body}</li>`;
    })
    .join("");
  return { html: `<${tag}${ordered && startNumber !== 1 ? ` start="${startNumber}"` : ""}>${html}</${tag}>`, next: i };
}

const leading = (line: string) => line.length - line.trimStart().length;

function cells(row: string): string[] {
  const out: string[] = [];
  let current = "";
  let inCode = false;
  const text = row.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\\" && text[i + 1] === "|") {
      current += "|";
      i++;
    } else if (char === "`") {
      inCode = !inCode;
      current += char;
    } else if (char === "|" && !inCode) {
      out.push(current.trim());
      current = "";
    } else current += char;
  }
  out.push(current.trim());
  return out;
}

function uniqueId(text: string, state: State): string {
  const base = slugify(text) || "section";
  let id = base;
  for (let n = 2; state.ids.has(id); n++) id = `${base}-${n}`;
  state.ids.add(id);
  return id;
}

// Inline

/** Heading text without Markdown markers, for titles and the table of contents. */
function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/[`*_]/gu, "")
    .trim();
}

function findClosing(text: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return i;
  }
  return -1;
}

/** `[label](href "title")` starting at `start` (the "["). */
function matchLink(text: string, start: number): { label: string; href: string; end: number } | null {
  const labelEnd = findClosing(text, start, "[", "]");
  if (labelEnd < 0 || text[labelEnd + 1] !== "(") return null;
  const targetEnd = findClosing(text, labelEnd + 1, "(", ")");
  if (targetEnd < 0) return null;
  const target = text.slice(labelEnd + 2, targetEnd).trim();
  const href = target.replace(/\s+"[^"]*"$/u, "").replace(/^<|>$/gu, "");
  return { label: text.slice(start + 1, labelEnd), href, end: targetEnd + 1 };
}

const isExternal = (href: string) => /^https?:\/\//iu.test(href);

function inline(text: string, state: State): string {
  const { resolveHref = (href: string) => href, resolveImage = (src: string) => src } = state.options;
  let out = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const rest = text.slice(i);

    if (char === "\\" && /[\\`*_[\]()#|!<>-]/u.test(text[i + 1] ?? "")) {
      out += escapeHtml(text[i + 1]);
      i += 2;
      continue;
    }
    if (char === "`") {
      const ticks = /^`+/u.exec(rest)![0];
      const end = text.indexOf(ticks, i + ticks.length);
      if (end > i) {
        out += `<code>${escapeHtml(text.slice(i + ticks.length, end).trim())}</code>`;
        i = end + ticks.length;
        continue;
      }
    }
    if (char === "!" && text[i + 1] === "[") {
      const link = matchLink(text, i + 1);
      if (link) {
        out += `<img src="${escapeHtml(resolveImage(link.href))}" alt="${escapeHtml(stripInline(link.label))}" loading="lazy" />`;
        i = link.end;
        continue;
      }
    }
    if (char === "[") {
      const link = matchLink(text, i);
      if (link) {
        const href = resolveHref(link.href);
        out += `<a href="${escapeHtml(href)}"${isExternal(href) ? ' rel="noopener"' : ""}>${inline(link.label, state)}</a>`;
        i = link.end;
        continue;
      }
    }
    const auto = /^<(https?:\/\/[^>\s]+)>/u.exec(rest);
    if (auto) {
      out += `<a href="${escapeHtml(auto[1])}" rel="noopener">${escapeHtml(auto[1])}</a>`;
      i += auto[0].length;
      continue;
    }
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const marker = rest.slice(0, 2);
      const end = text.indexOf(marker, i + 2);
      if (end > i + 2) {
        out += `<strong>${inline(text.slice(i + 2, end), state)}</strong>`;
        i = end + 2;
        continue;
      }
    }
    if ((char === "*" || char === "_") && /\S/u.test(text[i + 1] ?? "") && (char === "*" || !/\w/u.test(text[i - 1] ?? ""))) {
      let end = i + 1;
      while ((end = text.indexOf(char, end)) > 0 && (/\s/u.test(text[end - 1]) || (char === "_" && /\w/u.test(text[end + 1] ?? "")))) end++;
      if (end > i + 1) {
        out += `<em>${inline(text.slice(i + 1, end), state)}</em>`;
        i = end + 1;
        continue;
      }
    }
    out += escapeHtml(char);
    i++;
  }
  return out;
}

import { Check, Code2, Copy, ExternalLink, MessageSquareText, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { clientModules } from "@/modules/client";
import { repositoryUrl } from "@/shared/project";
import { Button, IconButton, Textarea, useToast } from "../ui";
import { coreDevPages } from "./core-pages";
import { buildDevEntries, findDevEntry } from "./match";
import { agentPrompt, issueUrl, type PromptContext } from "./prompt";

/**
 * The developer panel (dev mode): for the admin page on screen, the files
 * behind it, the MCP tools that do the same job, and ready-to-copy briefs for
 * a coding agent. Describe a change in your own words and it becomes a full
 * brief, or a GitHub issue. Notes per page: src/app/dev/core-pages.ts and
 * each module's client/dev.ts.
 */

const devEntries = buildDevEntries(coreDevPages, clientModules);

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export function DevPanel() {
  const location = useLocation();
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const entry = findDevEntry(devEntries, location.pathname);
  const context: PromptContext = { page: entry.page, moduleId: entry.moduleId, location: location.pathname };

  const copy = async (key: string, task: string) => {
    await copyText(agentPrompt(task, context));
    setCopied(key);
    toast("Brief copied. Paste it into Claude Code, Codex or Cursor in the repository.");
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 inline-flex h-9 items-center gap-2 rounded-full border bg-popover px-3.5 text-sm font-medium shadow-lg transition-colors hover:bg-accent print:hidden"
      >
        <Code2 className="size-4 text-primary" />
        Dev
        <span className="max-w-[10rem] truncate text-muted-foreground">{entry.page.title}</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Developer panel"
      className="fixed inset-x-2 bottom-2 z-40 flex max-h-[75dvh] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[420px] sm:max-h-[min(80dvh,760px)] print:hidden"
    >
      <header className="flex items-start gap-3 border-b px-4 py-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Code2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Developer panel</p>
          <h2 className="truncate text-sm font-semibold">{entry.page.title}</h2>
        </div>
        <IconButton label="Minimise the developer panel" onClick={() => setOpen(false)}>
          <X />
        </IconButton>
      </header>

      <div className="grid gap-5 overflow-y-auto px-4 py-4">
        <p className="text-sm text-muted-foreground">{entry.page.summary}</p>

        <section aria-labelledby="dev-prompts" className="grid gap-2">
          <h3 id="dev-prompts" className="text-xs font-medium text-muted-foreground">
            Ask an agent
          </h3>
          <ul className="grid gap-1.5">
            {entry.page.prompts.map((prompt, index) => {
              const key = `prompt-${index}`;
              return (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => copy(key, prompt)}
                    className="group flex w-full items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-input hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">{prompt}</span>
                    <span className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden>
                      {copied === key ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                    </span>
                    <span className="sr-only">Copy as a brief for a coding agent</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Each copies a full brief: the page, its files, the task and the rules and checks from AGENTS.md.</p>
        </section>

        <section aria-labelledby="dev-feedback" className="grid gap-2">
          <label id="dev-feedback" htmlFor="dev-feedback-text" className="text-xs font-medium text-muted-foreground">
            Describe a change or give feedback
          </label>
          <Textarea id="dev-feedback-text" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What should change on this page? Your own words are fine." />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!draft.trim()} onClick={() => copy("draft", draft)} icon={copied === "draft" ? <Check /> : <Copy />}>
              Copy brief for an agent
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={draft.trim() ? issueUrl(draft, context) : undefined} target="_blank" rel="noreferrer" aria-disabled={!draft.trim()} className={draft.trim() ? undefined : "pointer-events-none opacity-50"}>
                <MessageSquareText />
                Open a GitHub issue
              </a>
            </Button>
          </div>
        </section>

        <section aria-labelledby="dev-files" className="grid gap-2">
          <h3 id="dev-files" className="text-xs font-medium text-muted-foreground">
            Files behind this page
          </h3>
          <ul className="grid divide-y rounded-lg border bg-card text-sm">
            {entry.page.files.map((file) => (
              <li key={file.path} className="grid gap-0.5 px-3 py-2">
                <a href={repositoryUrl(file.path)} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-primary hover:underline">
                  <span className="truncate">{file.path}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
                <span className="text-xs text-muted-foreground">{file.note}</span>
              </li>
            ))}
            {entry.moduleId ? (
              <li className="grid gap-0.5 px-3 py-2">
                <a href={repositoryUrl(`src/modules/${entry.moduleId}/README.md`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline">
                  src/modules/{entry.moduleId}/README.md
                  <ExternalLink className="size-3 shrink-0" />
                </a>
                <span className="text-xs text-muted-foreground">How the module works and how to change it</span>
              </li>
            ) : null}
          </ul>
        </section>

        {entry.page.tools?.length ? (
          <section aria-labelledby="dev-tools" className="grid gap-2">
            <h3 id="dev-tools" className="text-xs font-medium text-muted-foreground">
              MCP tools for this page
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {entry.page.tools.map((tool) => (
                <li key={tool}>
                  <code className="rounded-md border bg-card px-1.5 py-0.5 text-xs">{tool}</code>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              A running agent calls these at <code>/mcp</code> with an API token from{" "}
              <Link to="/app/settings/api" className="text-primary hover:underline">
                Settings → API tokens
              </Link>
              .
            </p>
          </section>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs">
        <a href="/docs/agents" className="text-muted-foreground hover:text-foreground">
          AGENTS.md
        </a>
        <a href="/docs/skill" className="text-muted-foreground hover:text-foreground">
          Agent skill
        </a>
        <a href="/docs" className="text-muted-foreground hover:text-foreground">
          Docs
        </a>
        <Link to="/app/design" className="text-muted-foreground hover:text-foreground">
          Design system
        </Link>
      </footer>
    </aside>
  );
}

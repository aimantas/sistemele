import { Archive, ArchiveRestore, ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { useCan } from "@/app/lib/session";
import { Button, buttonVariants, Card, CardHeader, CheckboxField, ConfirmDialog, ErrorState, Field, FormError, Input, PageHeader, Spinner, Textarea, useToast } from "@/app/ui";
import { excerpt, Markdown, markdownText } from "../shared/markdown";
import { ENTRY_TYPE_LABELS, HOME_SLUG, entryPath, type Entry, type EntryPatch } from "../shared/schema";
import { useEntry, useEntryAction, useUpdateEntry, type EntryAction } from "./api";
import { StateBadge, StateDate } from "./parts";

export default function EntryEditorPage() {
  const { id = "" } = useParams();
  const entry = useEntry(id);
  if (entry.isLoading) return <Spinner />;
  if (entry.error || !entry.data) return <ErrorState error={entry.error} retry={() => entry.refetch()} />;
  // Keyed by id: switching entries starts a fresh form.
  return <Editor key={entry.data.id} entry={entry.data} />;
}

interface FormState {
  title: string;
  slug: string;
  summary: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  inMenu: boolean;
  menuOrder: string;
}

function toForm(entry: Entry): FormState {
  return {
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    body: entry.body,
    imageUrl: entry.imageUrl,
    imageAlt: entry.imageAlt,
    inMenu: entry.menuOrder !== null,
    menuOrder: entry.menuOrder === null ? "" : String(entry.menuOrder),
  };
}

function toPatch(form: FormState, entry: Entry): { patch: EntryPatch; errors: null } | { patch: null; errors: Record<string, string> } {
  const patch: EntryPatch = { title: form.title, summary: form.summary, body: form.body, imageUrl: form.imageUrl, imageAlt: form.imageAlt };
  if (form.slug !== entry.slug) patch.slug = form.slug;
  if (entry.type === "page") {
    if (!form.inMenu) patch.menuOrder = null;
    else {
      const position = Number(form.menuOrder.trim() || "1");
      if (!Number.isInteger(position) || position < 1 || position > 99) return { patch: null, errors: { menuOrder: "Use a whole number from 1 to 99." } };
      patch.menuOrder = position;
    }
  }
  return { patch, errors: null };
}

/** datetime-local value ("2026-11-20T09:00") from an ISO instant, in the browser's time zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Editor({ entry }: { entry: Entry }) {
  const isAdmin = useCan("admin");
  const toast = useToast();
  const update = useUpdateEntry(entry.id);
  const action = useEntryAction(entry.id);
  const [saved, setSaved] = useState<FormState>(() => toForm(entry));
  const [form, setForm] = useState<FormState>(saved);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"unpublish" | "archive" | null>(null);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const errors = (field: string) => localErrors[field] ?? fieldError(update.error, field) ?? fieldError(action.error, field);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const kind = ENTRY_TYPE_LABELS[entry.type].one;
  const listPath = entry.type === "page" ? "/app/content/pages" : "/app/content/posts";
  const archived = entry.status === "archived";
  const live = entry.status === "published";
  const canEdit = entry.status === "draft" || (live && isAdmin);

  /** Saves the form; resolves with the saved entry, or null when nothing needed saving or it failed. */
  const save = async (): Promise<Entry | null> => {
    const result = toPatch(form, entry);
    setLocalErrors(result.errors ?? {});
    if (!result.patch) return null;
    if (!dirty) return entry;
    try {
      const next = await update.mutateAsync(result.patch);
      const fresh = toForm(next);
      setSaved(fresh);
      setForm(fresh);
      return next;
    } catch {
      return null;
    }
  };

  const run = async (request: EntryAction, message: string) => {
    if (request.action === "publish" && !(await save())) return;
    action.mutate(request, { onSuccess: () => (setConfirm(null), toast(message)) });
  };

  return (
    <div>
      <PageHeader
        back={
          <Link to={listPath} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {entry.type === "page" ? "Pages" : "Posts"}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {entry.title}
            <StateBadge state={entry.state} />
          </span>
        }
        description={
          <>
            <span className="font-mono text-sm">{entry.path}</span> · <StateDate entry={entry} />
          </>
        }
        actions={
          <>
            {entry.state === "published" ? (
              <a href={entry.path} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
                <ExternalLink /> View on website
              </a>
            ) : null}
            {archived ? (
              <Button variant="outline" icon={<ArchiveRestore />} loading={action.isPending} onClick={() => run({ action: "restore" }, `${capitalise(kind)} restored as a draft.`)}>
                Restore
              </Button>
            ) : entry.status === "draft" || isAdmin ? (
              <Button variant="ghost" icon={<Archive />} onClick={() => setConfirm("archive")}>
                Archive
              </Button>
            ) : null}
          </>
        }
      />

      {!canEdit && !archived ? <p className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground/80">This {kind} is {entry.state}. Only owners and admins can change it.</p> : null}
      {archived ? <p className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground/80">This {kind} is archived. Restore it to edit or publish it again.</p> : null}

      <form
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (dirty && (await save())) toast(live ? "Changes saved." : "Draft saved.");
        }}
      >
        <fieldset disabled={!canEdit} className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader title="Text" />
            <div className="grid gap-4 p-5">
              <Field label="Title" error={errors("title")}>
                {(props) => <Input {...props} required value={form.title} onChange={(event) => set({ title: event.target.value })} />}
              </Field>
              <BodyField value={form.body} onChange={(body) => set({ body })} error={errors("body")} />
              <Field
                label="Summary"
                hint={`${entry.type === "page" && form.slug === HOME_SLUG ? "Shown under the headline on the home page and in search results." : "Shown in post lists, link previews and search results."} ${form.summary.length}/300`}
                error={errors("summary")}
              >
                {(props) => <Textarea {...props} rows={2} maxLength={300} value={form.summary} onChange={(event) => set({ summary: event.target.value })} />}
              </Field>
              <FormError error={update.error} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant={live || !isAdmin ? "default" : "outline"} loading={update.isPending} disabled={!dirty}>
                  {live ? "Save changes" : "Save draft"}
                </Button>
                {dirty ? (
                  <Button variant="ghost" onClick={() => (setForm(saved), setLocalErrors({}), update.reset())}>
                    Discard
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        </fieldset>

        <div className="grid content-start gap-6">
          {!archived ? <PublishCard entry={entry} isAdmin={isAdmin} dirty={dirty} busy={action.isPending || update.isPending} error={action.error} onRun={run} onUnpublish={() => setConfirm("unpublish")} /> : null}
          <fieldset disabled={!canEdit} className="grid min-w-0 content-start gap-6">
            <Card>
              <CardHeader title="Address" />
              <div className="grid gap-4 p-5">
                <Field label={entry.type === "page" ? "Page address" : "Post address"} hint={form.slug === HOME_SLUG && entry.type === "page" ? "“home” makes this your home page at /." : entry.status === "draft" ? undefined : "Unpublish to change the address."} error={errors("slug")}>
                  {(props) => (
                    <div className="flex items-center rounded-md border border-input bg-card focus-within:outline-3 focus-within:outline-primary/40 has-disabled:bg-muted">
                      <span className="pl-3 font-mono text-sm text-muted-foreground">{entry.type === "page" ? "/" : "/blog/"}</span>
                      <input
                        {...props}
                        className="h-10 min-w-0 flex-1 rounded-md bg-transparent pr-3 font-mono text-sm outline-none disabled:text-muted-foreground"
                        disabled={entry.status !== "draft"}
                        value={form.slug}
                        onChange={(event) => set({ slug: event.target.value.toLowerCase().replace(/\s+/gu, "-") })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  )}
                </Field>
                <SearchPreview form={form} path={entryPath(entry.type, form.slug)} />
              </div>
            </Card>
            {entry.type === "page" ? (
              <Card>
                <CardHeader title="Site menu" />
                <div className="grid gap-4 p-5">
                  <CheckboxField label="Show in the site menu" checked={form.inMenu} onChange={(inMenu) => set({ inMenu, menuOrder: inMenu && !form.menuOrder ? "1" : form.menuOrder })} />
                  {form.inMenu ? (
                    <Field label="Position" hint="1 comes first. Shown once the page is live." error={errors("menuOrder")}>
                      {(props) => <Input {...props} inputMode="numeric" className="tabular w-24" value={form.menuOrder} onChange={(event) => set({ menuOrder: event.target.value })} />}
                    </Field>
                  ) : null}
                </div>
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Image" />
              <div className="grid gap-4 p-5">
                <Field label="Image URL" hint="An https:// address or a path on this site. Also used in link previews." error={errors("imageUrl")}>
                  {(props) => <Input {...props} inputMode="url" autoComplete="off" value={form.imageUrl} onChange={(event) => set({ imageUrl: event.target.value })} placeholder="https://" />}
                </Field>
                {form.imageUrl ? (
                  <Field label="Image description" hint="For people who cannot see the image." error={errors("imageAlt")}>
                    {(props) => <Input {...props} value={form.imageAlt} onChange={(event) => set({ imageAlt: event.target.value })} />}
                  </Field>
                ) : null}
              </div>
            </Card>
          </fieldset>
        </div>
      </form>

      <ConfirmDialog
        open={confirm === "unpublish"}
        title={`Unpublish ${entry.title}?`}
        message={`It disappears from the website${entry.type === "page" && entry.menuOrder !== null ? " and the site menu" : ""}, and ${entry.path} stops working. The text stays here as a draft.`}
        confirmLabel={entry.state === "scheduled" ? "Cancel schedule" : `Unpublish ${kind}`}
        loading={action.isPending}
        onConfirm={() => run({ action: "unpublish" }, entry.state === "scheduled" ? "Schedule cancelled." : `${capitalise(kind)} unpublished.`)}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "archive"}
        title={`Archive ${entry.title}?`}
        message={`It leaves the ${entry.type === "page" ? "Pages" : "Posts"} list${live ? " and the website" : ""}. You can restore it later as a draft.`}
        confirmLabel={`Archive ${kind}`}
        loading={action.isPending}
        onConfirm={() => run({ action: "archive" }, `${capitalise(kind)} archived.`)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

const capitalise = (value: string) => value[0].toUpperCase() + value.slice(1);

/** Markdown textarea with a Write / Preview switch. */
function BodyField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const [preview, setPreview] = useState(false);
  const tab = (active: boolean) => `h-8 rounded-md px-3 text-sm font-medium ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="entry-body" className="text-sm font-medium text-foreground">
          Text
        </label>
        <div role="group" aria-label="Text view" className="flex gap-1">
          <button type="button" className={tab(!preview)} aria-pressed={!preview} onClick={() => setPreview(false)}>
            Write
          </button>
          <button type="button" className={tab(preview)} aria-pressed={preview} onClick={() => setPreview(true)}>
            Preview
          </button>
        </div>
      </div>
      {preview ? (
        <div className="prose min-h-72 rounded-md border border-border bg-card px-4 py-3">{value.trim() ? <Markdown source={value} /> : <p className="text-muted-foreground">Nothing to preview yet.</p>}</div>
      ) : (
        <textarea
          id="entry-body"
          aria-invalid={error ? true : undefined}
          aria-describedby="entry-body-hint"
          rows={18}
          className="min-h-72 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 disabled:bg-muted disabled:text-muted-foreground aria-[invalid=true]:border-destructive"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={"Write the text here.\n\n## A heading\n\nA paragraph with **bold** text and a [link](https://example.com).\n\n- A list item\n- Another item"}
        />
      )}
      {error ? (
        <p id="entry-body-hint" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id="entry-body-hint" className="text-sm text-muted-foreground">
          Markdown: ## heading · **bold** · *italic* · [link](https://…) · - list · &gt; quote
        </p>
      )}
    </div>
  );
}

/** How the entry may look as a search result: title, address, description. */
function SearchPreview({ form, path }: { form: FormState; path: string }) {
  const description = form.summary || excerpt(markdownText(form.body), 155);
  return (
    <div className="grid gap-0.5 rounded-md border border-border bg-background px-3 py-2.5" aria-label="Search result preview">
      <p className="truncate text-xs text-muted-foreground">{`${window.location.host}${path}`}</p>
      <p className="truncate font-medium text-info">{form.title || "Title"}</p>
      <p className="line-clamp-2 text-sm text-foreground/80">{description || <span className="text-muted-foreground">Add a summary or some text.</span>}</p>
    </div>
  );
}

function PublishCard({
  entry,
  isAdmin,
  dirty,
  busy,
  error,
  onRun,
  onUnpublish,
}: {
  entry: Entry;
  isAdmin: boolean;
  dirty: boolean;
  busy: boolean;
  error: unknown;
  onRun: (request: EntryAction, message: string) => void;
  onUnpublish: () => void;
}) {
  const format = useFormat();
  const [publishAt, setPublishAt] = useState(entry.state === "scheduled" && entry.publishedAt ? toLocalInput(entry.publishedAt) : "");
  // Whether the chosen time is still ahead, decided when it is picked (render must stay pure).
  const [future, setFuture] = useState(entry.state === "scheduled");
  const kind = ENTRY_TYPE_LABELS[entry.type].one;
  const at = publishAt ? new Date(publishAt) : null;
  const validAt = at && !Number.isNaN(at.getTime()) ? at : null;

  const status =
    entry.state === "published" ? (
      <>
        Live at{" "}
        <a href={entry.path} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline">
          {entry.path}
        </a>{" "}
        since {format.date(entry.publishedAt)}.
      </>
    ) : entry.state === "scheduled" ? (
      <>Goes live {format.dateTime(entry.publishedAt)}.</>
    ) : (
      <>Not on the website yet.</>
    );

  return (
    <Card>
      <CardHeader title="Publishing" />
      <div className="grid gap-4 p-5">
        <p className="text-sm text-foreground/80">{status}</p>
        {!isAdmin ? (
          <p className="text-sm text-muted-foreground">{entry.status === "draft" ? `Save your draft. An owner or admin publishes the ${kind}.` : `Ask an owner or admin to change or unpublish the ${kind}.`}</p>
        ) : entry.state === "published" ? (
          <Button variant="outline" onClick={onUnpublish} disabled={busy}>
            Unpublish
          </Button>
        ) : (
          <>
            <Field label="Publish time" hint={future && validAt ? "It goes live at this time." : "Leave empty to publish now. A later time schedules it."}>
              {(props) => (
                <Input
                  {...props}
                  type="datetime-local"
                  value={publishAt}
                  onChange={(event) => {
                    const value = event.target.value;
                    const time = value ? new Date(value).getTime() : NaN;
                    setPublishAt(value);
                    setFuture(time > Date.now());
                  }}
                />
              )}
            </Field>
            <div className="grid gap-2">
              <Button
                variant={entry.state === "draft" ? "default" : "outline"}
                loading={busy}
                onClick={() =>
                  onRun(
                    { action: "publish", input: validAt ? { publishAt: validAt.toISOString() } : {} },
                    future && validAt ? `${capitalise(kind)} scheduled for ${format.dateTime(validAt!.toISOString())}.` : `${capitalise(kind)} published.`,
                  )
                }
              >
                {future && validAt ? (entry.state === "scheduled" ? "Change schedule" : "Schedule") : dirty ? "Save and publish" : "Publish now"}
              </Button>
              {entry.state === "scheduled" ? (
                <Button variant="ghost" onClick={onUnpublish} disabled={busy}>
                  Cancel schedule
                </Button>
              ) : null}
            </div>
          </>
        )}
        <FormError error={error} />
      </div>
    </Card>
  );
}

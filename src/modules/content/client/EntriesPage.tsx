import { FileText, House, Newspaper, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { errorMessage, fieldError } from "@/app/lib/api";
import { useCan } from "@/app/lib/session";
import { Button, Dialog, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Select, Spinner, Table, Td, Th, Tr, useToast } from "@/app/ui";
import { ENTRY_STATE_LABELS, ENTRY_STATES, HOME_SLUG, type Entry, type EntryListQuery, type EntryType } from "../shared/schema";
import { useCreateEntry, useEntries } from "./api";
import { StateBadge, StateDate } from "./parts";

const PAGE_SIZE = 50;

const COPY = {
  page: {
    title: "Pages",
    description: "Pages on your website, such as About or Delivery. Put the important ones in the site menu.",
    create: "New page",
    icon: <FileText />,
    empty: "No pages yet",
    emptyText: "Write an About page or explain how ordering and delivery work. Pages appear at their own address on your website.",
  },
  post: {
    title: "Posts",
    description: "News and articles on your blog, newest first.",
    create: "New post",
    icon: <Newspaper />,
    empty: "No posts yet",
    emptyText: "Share news, answer common questions or show finished work. Posts appear on /blog when you publish them.",
  },
} as const;

/** Pages and Posts lists: same screen, one type each. `?new=1` opens the New dialog. */
export function EntriesPage({ type }: { type: EntryType }) {
  const copy = COPY[type];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const q = params.get("q") ?? "";
  const state = ENTRY_STATES.find((value) => value === params.get("state"));
  const offset = Number(params.get("offset") ?? 0) || 0;
  const query: EntryListQuery = { type, state, q: q || undefined, limit: PAGE_SIZE, offset };
  const entries = useEntries(query);
  const filtered = Boolean(q || state);

  const setParam = (key: string, value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("offset");
      next.delete("new");
      return next;
    });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (term !== q) setParam("q", term || null);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is recreated each render; only the text matters
  }, [term, q]);

  const total = entries.data?.total ?? 0;
  const createButton = (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      {copy.create}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            {type === "page" ? <HomePageButton /> : null}
            {createButton}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label={`Search ${copy.title.toLowerCase()}`} placeholder="Search title or address" className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>
        <Select aria-label="Status" className="w-auto" value={state ?? ""} onChange={(event) => setParam("state", event.target.value || null)}>
          <option value="">All but archived</option>
          {ENTRY_STATES.map((value) => (
            <option key={value} value={value}>
              {ENTRY_STATE_LABELS[value]}
            </option>
          ))}
        </Select>
        <p className="ml-auto text-sm text-muted">{entries.data ? `${total} ${total === 1 ? type : `${type}s`}` : null}</p>
      </div>

      {entries.error ? <ErrorState error={entries.error} retry={() => entries.refetch()} /> : null}
      {entries.isLoading ? <Spinner /> : null}
      {entries.data && entries.data.items.length === 0 ? (
        <EmptyState icon={copy.icon} title={filtered ? `No ${type}s match` : copy.empty} description={filtered ? "Try another search or status." : copy.emptyText} action={filtered ? null : createButton} />
      ) : null}
      {entries.data && entries.data.items.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Status</Th>
                {type === "page" ? <Th className="hidden md:table-cell">Menu</Th> : null}
                <Th className="hidden sm:table-cell">Last change</Th>
              </tr>
            </thead>
            <tbody>
              {entries.data.items.map((entry) => (
                <Tr key={entry.id}>
                  <Td>
                    <Link to={`/app/content/${entry.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                      {entry.title}
                    </Link>
                    <p className="font-mono text-xs break-all text-muted">{entry.path}</p>
                  </Td>
                  <Td>
                    <StateBadge state={entry.state} />
                    <p className="mt-1 text-xs text-muted sm:hidden">
                      <StateDate entry={entry} />
                    </p>
                  </Td>
                  {type === "page" ? <Td className="hidden tabular md:table-cell">{entry.menuOrder ?? <span className="text-muted">—</span>}</Td> : null}
                  <Td className="hidden text-ink-soft sm:table-cell">
                    <StateDate entry={entry} />
                    {entry.updatedByName ? <p className="text-xs text-muted">{entry.updatedByName}</p> : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" disabled={offset === 0} onClick={() => setParams((p) => (p.set("offset", String(Math.max(0, offset - PAGE_SIZE))), p))}>
                Previous
              </Button>
              <span className="text-sm text-muted">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setParams((p) => (p.set("offset", String(offset + PAGE_SIZE)), p))}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <NewEntryDialog type={type} open={creating} onClose={() => setCreating(false)} onCreated={(entry) => navigate(`/app/content/${entry.id}`)} />
    </div>
  );
}

/** Opens the home page (the page at "/"), creating it as a draft the first time. */
function HomePageButton() {
  const navigate = useNavigate();
  const toast = useToast();
  const found = useEntries({ type: "page", q: HOME_SLUG, limit: 20 });
  const create = useCreateEntry();
  const home = found.data?.items.find((entry) => entry.slug === HOME_SLUG);
  return (
    <Button
      icon={<House />}
      loading={create.isPending}
      disabled={!found.data}
      onClick={() =>
        home
          ? navigate(`/app/content/${home.id}`)
          : create.mutate({ type: "page", title: "Home", slug: HOME_SLUG }, { onSuccess: (entry) => navigate(`/app/content/${entry.id}`), onError: (error) => toast(errorMessage(error), "danger") })
      }
    >
      Home page
    </Button>
  );
}

/** Asks only for the title; the editor opens on the new draft. */
function NewEntryDialog({ type, open, onClose, onCreated }: { type: EntryType; open: boolean; onClose: () => void; onCreated: (entry: Entry) => void }) {
  const create = useCreateEntry();
  const [title, setTitle] = useState("");
  const canPublish = useCan("admin");
  const submit = () =>
    create.mutate(
      { type, title },
      {
        onSuccess: (entry) => {
          setTitle("");
          onClose();
          onCreated(entry);
        },
      },
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={COPY[type].create}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            Create draft
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Title" hint={canPublish ? "You write the text next. It stays a draft until you publish it." : "You write the text next. An owner or admin publishes it."} error={fieldError(create.error, "title")}>
          {(props) => <Input {...props} required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "page" ? "About us" : "How we price custom gates"} />}
        </Field>
        <FormError error={create.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

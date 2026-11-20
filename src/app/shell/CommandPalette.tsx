import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { SearchResult } from "@/shared/api";
import { clientModules } from "@/modules/client";
import { api } from "../lib/api";

/** Ctrl/Cmd+K: search records across modules and jump to quick actions. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setTerm("");
      setCursor(0);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 150);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useQuery({ queryKey: ["search", debounced], queryFn: () => api.get<{ items: SearchResult[] }>(`/api/search?q=${encodeURIComponent(debounced)}`), enabled: open && debounced.length >= 2 });
  const actions = clientModules.flatMap((module) => module.quickActions ?? []).filter((action) => !term || action.label.toLowerCase().includes(term.toLowerCase()));
  const items = [...(results.data?.items ?? []).map((item) => ({ key: `${item.type}:${item.id}`, label: item.title, hint: item.subtitle ?? item.type, to: item.href })), ...actions.map((action) => ({ key: action.to, label: action.label, hint: "Action", to: action.to }))];

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border bg-popover p-0 text-popover-foreground shadow-lg backdrop:bg-black/50"
      aria-label="Search"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setCursor(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (event.key === "Enter" && items[cursor]) go(items[cursor].to);
          }}
          placeholder="Search contacts, products, quotes, invoices…"
          className="h-12 flex-1 bg-transparent outline-none"
          aria-label="Search"
        />
      </div>
      <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
        {items.map((item, index) => (
          <li key={item.key} role="option" aria-selected={index === cursor}>
            <button type="button" onMouseEnter={() => setCursor(index)} onClick={() => go(item.to)} className={clsx("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", index === cursor && "bg-accent")}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">{debounced.length >= 2 && !results.isFetching ? "Nothing found." : "Type at least two letters."}</li> : null}
      </ul>
    </dialog>
  );
}

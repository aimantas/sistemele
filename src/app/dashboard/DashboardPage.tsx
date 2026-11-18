import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { GripVertical, LayoutTemplate, Maximize2, Minimize2, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { Component, Suspense, useMemo, useState, type ReactNode } from "react";
import type { DashboardLayout, DashboardWidgetInstance, WidgetSize } from "@/shared/api";
import { roleAtLeast } from "@/shared/auth";
import { api } from "../lib/api";
import { useUser } from "../lib/session";
import { Button, Dialog, ErrorState, IconButton, PageHeader, Spinner, Textarea, useToast } from "../ui";
import { useMetrics } from "./core-widgets";
import { findWidget, widgetRegistry, widgetTypes } from "./registry";
import { dashboardTemplates, layoutFromTemplate } from "./templates";

// Static class maps so Tailwind can see every class.
const COL_SPAN: Record<WidgetSize["w"], string> = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-2 xl:col-span-3", 4: "sm:col-span-2 xl:col-span-4" };
const ROW_SPAN: Record<WidgetSize["h"], string> = { 1: "", 2: "row-span-2" };

function useLayout() {
  const metrics = useMetrics();
  const query = useQuery({ queryKey: ["dashboard-layout"], queryFn: () => api.get<{ layout: DashboardLayout | null }>("/api/dashboard/layout") });
  const fallback = useMemo(() => {
    const knownMetrics = metrics.data ? new Set(metrics.data.available.map((m) => m.key)) : undefined;
    return layoutFromTemplate(dashboardTemplates[0], widgetTypes, knownMetrics);
  }, [metrics.data]);
  return { layout: query.data?.layout ?? fallback, isLoading: query.isLoading || metrics.isLoading, error: query.error, isCustom: Boolean(query.data?.layout) };
}

export default function DashboardPage() {
  const user = useUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { layout, isLoading, error, isCustom } = useLayout();
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [adding, setAdding] = useState(false);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const [editingNote, setEditingNote] = useState<DashboardWidgetInstance | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const editing = draft !== null;
  const current = draft ?? layout;

  const save = useMutation({
    mutationFn: (next: DashboardLayout) => api.put<{ layout: DashboardLayout }>("/api/dashboard/layout", next),
    onSuccess: (data) => {
      queryClient.setQueryData(["dashboard-layout"], data);
      setDraft(null);
      toast("Dashboard saved");
    },
    onError: () => toast("Could not save the dashboard. Try again.", "danger"),
  });
  const reset = useMutation({
    mutationFn: () => api.delete("/api/dashboard/layout"),
    onSuccess: () => {
      queryClient.setQueryData(["dashboard-layout"], { layout: null });
      setDraft(null);
      toast("Dashboard reset to the default");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = current.widgets.filter((widget) => {
    const definition = findWidget(widget.type);
    return definition && roleAtLeast(user.role, definition.minRole ?? "member");
  });
  const update = (widgets: DashboardWidgetInstance[]) => setDraft({ version: 1, widgets });

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!draft || !event.over || event.active.id === event.over.id) return;
    const from = draft.widgets.findIndex((widget) => widget.id === event.active.id);
    const to = draft.widgets.findIndex((widget) => widget.id === event.over?.id);
    if (from >= 0 && to >= 0) update(arrayMove(draft.widgets, from, to));
  };
  const active = activeId ? current.widgets.find((widget) => widget.id === activeId) : undefined;

  return (
    <div>
      <PageHeader
        title={`Hello${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={editing ? "Drag cards to reorder. Use the arrows to resize. Save when you are done." : undefined}
        actions={
          editing ? (
            <>
              <Button icon={<Plus />} onClick={() => setAdding(true)}>
                Add card
              </Button>
              <Button icon={<LayoutTemplate />} onClick={() => setChoosingTemplate(true)}>
                Templates
              </Button>
              {isCustom ? (
                <Button variant="ghost" icon={<RotateCcw />} onClick={() => reset.mutate()} loading={reset.isPending}>
                  Reset
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => save.mutate(draft)} loading={save.isPending}>
                Save layout
              </Button>
            </>
          ) : (
            <Button icon={<Settings2 />} onClick={() => setDraft(structuredClone(layout))}>
              Customize
            </Button>
          )
        }
      />

      {error ? <ErrorState error={error} /> : null}
      {isLoading ? (
        <Spinner />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={visible.map((widget) => widget.id)} strategy={rectSortingStrategy} disabled={!editing}>
            <div className="grid grid-flow-row-dense auto-rows-[minmax(168px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visible.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  editing={editing}
                  onResize={(size) => update(current.widgets.map((item) => (item.id === widget.id ? { ...item, size } : item)))}
                  onRemove={() => update(current.widgets.filter((item) => item.id !== widget.id))}
                  onEdit={widget.type === "core.note" ? () => setEditingNote(widget) : undefined}
                />
              ))}
              {editing ? (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed border-line-strong text-muted hover:border-brand hover:text-brand"
                >
                  <Plus className="size-5" />
                  <span className="text-sm font-medium">Add card</span>
                </button>
              ) : null}
            </div>
          </SortableContext>
          <DragOverlay>{active ? <WidgetCard widget={active} editing overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      <AddWidgetDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(widget) => {
          update([...(draft ?? layout).widgets, widget]);
          setAdding(false);
        }}
      />
      <Dialog open={choosingTemplate} onClose={() => setChoosingTemplate(false)} title="Start from a template">
        <ul className="grid gap-2">
          {dashboardTemplates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="w-full rounded-control border border-line px-4 py-3 text-left hover:border-brand hover:bg-brand-soft/40"
                onClick={() => {
                  setDraft(layoutFromTemplate(template, widgetTypes));
                  setChoosingTemplate(false);
                }}
              >
                <span className="block font-medium">{template.name}</span>
                <span className="block text-sm text-muted">{template.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">A template replaces the cards in your draft. Nothing is saved until you press Save layout.</p>
      </Dialog>
      <NoteEditor
        widget={editingNote}
        onClose={() => setEditingNote(null)}
        onSave={(text) => {
          if (!editingNote) return;
          update(current.widgets.map((item) => (item.id === editingNote.id ? { ...item, config: { ...item.config, text } } : item)));
          setEditingNote(null);
        }}
      />
    </div>
  );
}

function SortableWidget(props: { widget: DashboardWidgetInstance; editing: boolean; onResize: (size: WidgetSize) => void; onRemove: () => void; onEdit?: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.widget.id, disabled: !props.editing });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(COL_SPAN[props.widget.size.w], ROW_SPAN[props.widget.size.h], isDragging && "opacity-40")}
    >
      <WidgetCard {...props} handle={{ ref: setActivatorNodeRef, ...attributes, ...listeners }} />
    </div>
  );
}

function WidgetCard({
  widget,
  editing,
  overlay,
  handle,
  onResize,
  onRemove,
  onEdit,
}: {
  widget: DashboardWidgetInstance;
  editing: boolean;
  overlay?: boolean;
  handle?: Record<string, unknown> & { ref?: (element: HTMLElement | null) => void };
  onResize?: (size: WidgetSize) => void;
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  const definition = findWidget(widget.type);
  if (!definition) return null;
  const Widget = definition.component;
  const { w, h } = widget.size;
  return (
    <section className={clsx("flex h-full flex-col rounded-panel border bg-surface", editing ? "border-line-strong" : "border-line", overlay && "rotate-1 shadow-2xl")} aria-label={definition.title}>
      <header className={clsx("flex min-h-11 items-center gap-1 border-b border-line px-3", definition.bare && !editing && "hidden")}>
        {editing ? (
          <button type="button" className="-ml-1 inline-grid size-8 cursor-grab touch-none place-items-center rounded-control text-muted hover:bg-sunken active:cursor-grabbing" aria-label={`Move ${definition.title}`} {...handle}>
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-soft">{definition.title}</h2>
        {editing && onResize ? (
          <div className="flex items-center">
            <IconButton label="Narrower" disabled={w === 1} onClick={() => onResize({ w: (w - 1) as WidgetSize["w"], h })}>
              <Minimize2 />
            </IconButton>
            <IconButton label="Wider" disabled={w === 4} onClick={() => onResize({ w: (w + 1) as WidgetSize["w"], h })}>
              <Maximize2 />
            </IconButton>
            <button type="button" className="h-8 rounded-control px-2 text-xs font-medium text-muted hover:bg-sunken" onClick={() => onResize({ w, h: h === 1 ? 2 : 1 })}>
              {h === 1 ? "Taller" : "Shorter"}
            </button>
            {onEdit ? (
              <button type="button" className="h-8 rounded-control px-2 text-xs font-medium text-muted hover:bg-sunken" onClick={onEdit}>
                Edit
              </button>
            ) : null}
            <IconButton label={`Remove ${definition.title}`} onClick={onRemove}>
              <Trash2 />
            </IconButton>
          </div>
        ) : null}
      </header>
      <div className={clsx("min-h-0 flex-1 overflow-auto p-4", editing && "pointer-events-none select-none")}>
        <WidgetBoundary>
          <Suspense fallback={<Spinner />}>
            <Widget config={widget.config ?? {}} size={widget.size} />
          </Suspense>
        </WidgetBoundary>
      </div>
    </section>
  );
}

/** One failing widget never breaks the whole dashboard. */
class WidgetBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? <ErrorState error={this.state.error} /> : this.props.children;
  }
}

function AddWidgetDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (widget: DashboardWidgetInstance) => void }) {
  const user = useUser();
  const metrics = useMetrics();
  const add = (type: string, size: WidgetSize, config?: Record<string, unknown>) => onAdd({ id: crypto.randomUUID().slice(0, 8), type, size, config });
  const widgets = widgetRegistry.filter((widget) => widget.type !== "core.metric" && roleAtLeast(user.role, widget.minRole ?? "member"));
  return (
    <Dialog open={open} onClose={onClose} title="Add a card" size="lg">
      <h3 className="mb-2 text-sm font-semibold text-muted uppercase">Numbers</h3>
      <ul className="mb-6 grid gap-2 sm:grid-cols-2">
        {(metrics.data?.available ?? []).map((metric) => (
          <li key={metric.key}>
            <button type="button" className="h-full w-full rounded-control border border-line px-3 py-2 text-left hover:border-brand hover:bg-brand-soft/40" onClick={() => add("core.metric", { w: 1, h: 1 }, { metric: metric.key })}>
              <span className="block text-sm font-medium">{metric.label}</span>
              <span className="block text-xs text-muted">{metric.description}</span>
            </button>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 text-sm font-semibold text-muted uppercase">Cards</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {widgets.map((widget) => (
          <li key={widget.type}>
            <button type="button" className="h-full w-full rounded-control border border-line px-3 py-2 text-left hover:border-brand hover:bg-brand-soft/40" onClick={() => add(widget.type, widget.defaultSize)}>
              <span className="block text-sm font-medium">{widget.title}</span>
              <span className="block text-xs text-muted">{widget.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function NoteEditor({ widget, onClose, onSave }: { widget: DashboardWidgetInstance | null; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  if (widget && widget.id !== lastId) {
    setLastId(widget.id);
    setText(String(widget.config?.text ?? ""));
  }
  return (
    <Dialog
      open={Boolean(widget)}
      onClose={onClose}
      title="Edit note"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(text.slice(0, 1000))}>
            Update note
          </Button>
        </>
      }
    >
      <Textarea aria-label="Note text" value={text} maxLength={1000} rows={5} onChange={(event) => setText(event.target.value)} />
    </Dialog>
  );
}

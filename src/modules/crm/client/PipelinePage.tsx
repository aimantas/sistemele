import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { useState } from "react";
import { Link } from "react-router";
import { useFormat } from "@/app/lib/format";
import { ErrorState, PageHeader, Spinner } from "@/app/ui";
import { DEAL_STAGES, type Deal, type DealStage } from "../shared/schema";
import { useDeals, useMoveDeal } from "./api";

/** Kanban board: drag deals between stages. Positions are fractional, so a move writes one row. */
export default function PipelinePage() {
  const format = useFormat();
  const deals = useDeals();
  const move = useMoveDeal();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (deals.isLoading) return <Spinner />;
  if (deals.error || !deals.data) return <ErrorState error={deals.error} retry={() => deals.refetch()} />;
  const byStage = (stage: DealStage) => deals.data.filter((deal) => deal.stage === stage).sort((a, b) => a.position - b.position);
  const stageOf = (id: string): DealStage | undefined => (DEAL_STAGES.some((s) => s.id === id) ? (id as DealStage) : deals.data.find((deal) => deal.id === id)?.stage);
  const active = deals.data.find((deal) => deal.id === activeId);

  const onDragOver = (event: DragOverEvent) => setOverStage(event.over ? (stageOf(String(event.over.id)) ?? null) : null);
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverStage(null);
    const deal = deals.data.find((item) => item.id === event.active.id);
    if (!deal || !event.over) return;
    const stage = stageOf(String(event.over.id));
    if (!stage) return;
    const column = byStage(stage).filter((item) => item.id !== deal.id);
    const overIndex = column.findIndex((item) => item.id === event.over?.id);
    const index = overIndex === -1 ? column.length : overIndex;
    const before = column[index - 1]?.position;
    const after = column[index]?.position;
    const position = before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
    if (stage === deal.stage && position === deal.position) return;
    move.mutate({ id: deal.id, stage, position });
  };

  return (
    <div>
      <PageHeader title="Pipeline" description="Drag a deal to move it. Sending a quote moves it to Proposal; an accepted quote marks it Won." />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => setActiveId(String(event.active.id))} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {DEAL_STAGES.map((stage) => {
            const column = byStage(stage.id);
            const total = column.reduce((sum, deal) => sum + deal.valueCents, 0);
            return (
              <Column key={stage.id} id={stage.id} highlighted={overStage === stage.id}>
                <header className="flex items-baseline justify-between gap-2 px-1 pb-3">
                  <h2 className="text-sm font-semibold">
                    {stage.label} <span className="font-normal text-muted">{column.length}</span>
                  </h2>
                  <span className="tabular text-xs text-muted">{format.money(total)}</span>
                </header>
                <SortableContext items={column.map((deal) => deal.id)} strategy={verticalListSortingStrategy}>
                  <ul className="grid min-h-24 content-start gap-2">
                    {column.map((deal) => (
                      <DealCard key={deal.id} deal={deal} />
                    ))}
                  </ul>
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{active ? <DealCardBody deal={active} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ id, highlighted, children }: { id: string; highlighted: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={id} className={clsx("w-72 shrink-0 snap-start rounded-panel border p-3 transition-colors 2xl:w-auto 2xl:min-w-0 2xl:flex-1", highlighted ? "border-brand bg-brand-soft/50" : "border-line bg-sunken/50")}>
      {children}
    </section>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx("touch-none", isDragging && "opacity-40")} {...attributes} {...listeners}>
      <DealCardBody deal={deal} />
    </li>
  );
}

function DealCardBody({ deal, overlay }: { deal: Deal; overlay?: boolean }) {
  const format = useFormat();
  return (
    <div className={clsx("cursor-grab rounded-control border border-line bg-surface p-3 active:cursor-grabbing", overlay && "rotate-2 shadow-xl")}>
      <p className="text-sm font-medium">{deal.title}</p>
      <Link to={`/app/crm/contacts/${deal.contactId}`} className="text-xs text-muted hover:text-brand hover:underline" onPointerDown={(event) => event.stopPropagation()}>
        {deal.contactName}
      </Link>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="tabular font-semibold">{format.money(deal.valueCents)}</span>
        {deal.expectedCloseDate ? <span className="text-muted">{format.date(deal.expectedCloseDate)}</span> : null}
      </div>
    </div>
  );
}

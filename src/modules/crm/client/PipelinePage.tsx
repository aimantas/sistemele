import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Button, ButtonLink, Dialog, ErrorState, Field, FormError, Input, MoneyInput, PageHeader, Select, Spinner, Textarea } from "@/app/ui";
import type { Deal, Stage } from "../shared/schema";
import { useDeals, useMoveDeal, useStages, useUpdateDeal } from "./api";
import { OwnerSelect } from "./parts";

type PendingMove = { deal: Deal; stage: Stage; position: number };

/**
 * Kanban board: drag deals between stages. Positions are fractional, so a
 * move writes one row. Dropping on a lost stage asks for the reason first.
 */
export default function PipelinePage() {
  const format = useFormat();
  const [params, setParams] = useSearchParams();
  const mine = params.get("owner") === "me";
  const listKey = mine ? { ownerId: "me" } : {};
  const stages = useStages();
  const deals = useDeals(listKey);
  const move = useMoveDeal(listKey);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [lostMove, setLostMove] = useState<PendingMove | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (deals.isLoading || stages.isLoading) return <Spinner />;
  if (deals.error || !deals.data) return <ErrorState error={deals.error} retry={() => deals.refetch()} />;
  if (stages.error || !stages.data) return <ErrorState error={stages.error} retry={() => stages.refetch()} />;
  const stageList = stages.data;
  const dealList = deals.data;
  const byStage = (stageId: string) => dealList.filter((deal) => deal.stage === stageId).sort((a, b) => a.position - b.position);
  const stageOf = (id: string): Stage | undefined => stageList.find((stage) => stage.id === id) ?? stageList.find((stage) => stage.id === dealList.find((deal) => deal.id === id)?.stage);
  const active = dealList.find((deal) => deal.id === activeId);
  const openDeals = dealList.filter((deal) => deal.stageKind === "open");
  const openValue = openDeals.reduce((sum, deal) => sum + deal.valueCents, 0);
  const weighted = openDeals.reduce((sum, deal) => sum + Math.floor((deal.valueCents * deal.probabilityBps) / 10_000), 0);

  const onDragOver = (event: DragOverEvent) => setOverStage(event.over ? (stageOf(String(event.over.id))?.id ?? null) : null);
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverStage(null);
    const deal = dealList.find((item) => item.id === event.active.id);
    if (!deal || !event.over) return;
    const stage = stageOf(String(event.over.id));
    if (!stage) return;
    const column = byStage(stage.id).filter((item) => item.id !== deal.id);
    const overIndex = column.findIndex((item) => item.id === event.over?.id);
    const index = overIndex === -1 ? column.length : overIndex;
    const before = column[index - 1]?.position;
    const after = column[index]?.position;
    const position = before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
    if (stage.id === deal.stage && position === deal.position) return;
    if (stage.kind === "lost" && deal.stage !== stage.id) return setLostMove({ deal, stage, position });
    move.mutate({ id: deal.id, stage: stage.id, position });
  };

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={
          <span className="tabular">
            {format.money(openValue)} open · {format.money(weighted)} weighted
          </span>
        }
        actions={
          <>
            <Select aria-label="Whose deals" className="w-auto" value={mine ? "me" : ""} onChange={(event) => setParams(event.target.value ? { owner: "me" } : {})}>
              <option value="">Everyone's deals</option>
              <option value="me">My deals</option>
            </Select>
            <ButtonLink variant="outline" to="/app/crm/stages" icon={<Settings2 />}>
              Stages
            </ButtonLink>
          </>
        }
      />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => setActiveId(String(event.active.id))} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {stageList.map((stage) => {
            const column = byStage(stage.id);
            const total = column.reduce((sum, deal) => sum + deal.valueCents, 0);
            return (
              <Column key={stage.id} id={stage.id} label={stage.label} highlighted={overStage === stage.id}>
                <header className="grid gap-0.5 px-1 pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      {stage.label} <span className="font-normal text-muted-foreground">{column.length}</span>
                    </h2>
                    <span className="tabular text-xs text-muted-foreground">{format.money(total)}</span>
                  </div>
                  {stage.kind === "open" ? <p className="tabular text-xs text-muted-foreground">{format.vat(stage.probabilityBps)}</p> : null}
                </header>
                <SortableContext items={column.map((deal) => deal.id)} strategy={verticalListSortingStrategy}>
                  <ul className="grid min-h-24 content-start gap-2">
                    {column.map((deal) => (
                      <DealCard key={deal.id} deal={deal} onOpen={() => setEditing(deal)} />
                    ))}
                  </ul>
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{active ? <DealCardBody deal={active} overlay /> : null}</DragOverlay>
      </DndContext>
      {editing ? <DealDialog key={editing.id} deal={dealList.find((deal) => deal.id === editing.id) ?? editing} stages={stageList} onClose={() => setEditing(null)} /> : null}
      {lostMove ? (
        <LostDialog
          pending={lostMove}
          loading={move.isPending}
          onClose={() => setLostMove(null)}
          onConfirm={(lostReason) => move.mutate({ id: lostMove.deal.id, stage: lostMove.stage.id, position: lostMove.position, lostReason }, { onSettled: () => setLostMove(null) })}
        />
      ) : null}
    </div>
  );
}

function Column({ id, label, highlighted, children }: { id: string; label: string; highlighted: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={label} className={clsx("w-72 shrink-0 snap-start rounded-xl border p-3 transition-colors 2xl:w-auto 2xl:min-w-0 2xl:flex-1", highlighted ? "border-primary bg-primary/5" : "border-border bg-muted/50")}>
      {children}
    </section>
  );
}

function DealCard({ deal, onOpen }: { deal: Deal; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx("touch-none", isDragging && "opacity-40")} {...attributes} {...listeners}>
      <DealCardBody deal={deal} onOpen={onOpen} />
    </li>
  );
}

/** Stops the board's drag sensors so links and buttons inside a card still work. */
const stop = { onPointerDown: (event: React.PointerEvent) => event.stopPropagation(), onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation() };

function DealCardBody({ deal, overlay, onOpen }: { deal: Deal; overlay?: boolean; onOpen?: () => void }) {
  const format = useFormat();
  return (
    <div className={clsx("cursor-grab rounded-md border border-border bg-card p-3 active:cursor-grabbing", overlay && "rotate-2 shadow-xl")}>
      <button type="button" className="block text-left text-sm font-medium hover:text-primary hover:underline" onClick={onOpen} {...stop}>
        {deal.title}
      </button>
      <Link to={`/app/crm/contacts/${deal.contactId}`} className="text-xs text-muted-foreground hover:text-primary hover:underline" {...stop}>
        {deal.contactName}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="tabular font-semibold">{format.money(deal.valueCents)}</span>
        <span className="truncate text-muted-foreground">{[deal.expectedCloseDate ? format.date(deal.expectedCloseDate) : null, deal.ownerName].filter(Boolean).join(" · ")}</span>
      </div>
      {deal.stageKind === "lost" && deal.lostReason ? <p className="mt-1 truncate text-xs text-destructive">{deal.lostReason}</p> : null}
    </div>
  );
}

function DealDialog({ deal, stages, onClose }: { deal: Deal; stages: Stage[]; onClose: () => void }) {
  const update = useUpdateDeal(deal.id);
  const [title, setTitle] = useState(deal.title);
  const [valueCents, setValueCents] = useState<number | null>(deal.valueCents);
  const [closeDate, setCloseDate] = useState(deal.expectedCloseDate ?? "");
  const [ownerId, setOwnerId] = useState(deal.ownerId);
  const [stage, setStage] = useState(deal.stage);
  const [lostReason, setLostReason] = useState(deal.lostReason);
  const lost = stages.find((item) => item.id === stage)?.kind === "lost";
  return (
    <Dialog
      open
      onClose={onClose}
      title="Deal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            loading={update.isPending}
            onClick={() => update.mutate({ title, valueCents: valueCents ?? 0, expectedCloseDate: closeDate || null, ownerId, stage, ...(lost ? { lostReason } : {}) }, { onSuccess: onClose })}
          >
            Save deal
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2" error={fieldError(update.error, "title")}>
          {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} />}
        </Field>
        <Field label="Value (net)" error={fieldError(update.error, "valueCents")}>
          {(props) => <MoneyInput {...props} value={valueCents} onValueChange={setValueCents} />}
        </Field>
        <Field label="Expected close" error={fieldError(update.error, "expectedCloseDate")}>
          {(props) => <Input {...props} type="date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} />}
        </Field>
        <Field label="Stage" error={fieldError(update.error, "stage")}>
          {(props) => (
            <Select {...props} value={stage} onChange={(event) => setStage(event.target.value)}>
              {stages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <OwnerSelect value={ownerId} onChange={setOwnerId} error={fieldError(update.error, "ownerId")} />
        {lost ? (
          <Field label="Why it was lost" className="sm:col-span-2" error={fieldError(update.error, "lostReason")}>
            {(props) => <Textarea {...props} rows={2} value={lostReason} onChange={(event) => setLostReason(event.target.value)} />}
          </Field>
        ) : null}
        <p className="text-sm sm:col-span-2">
          <Link className="text-primary hover:underline" to={`/app/crm/contacts/${deal.contactId}`}>
            Open {deal.contactName}
          </Link>
        </p>
        <div className="sm:col-span-2">
          <FormError error={update.error} />
        </div>
      </div>
    </Dialog>
  );
}

function LostDialog({ pending, loading, onClose, onConfirm }: { pending: PendingMove; loading: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Mark ${pending.deal.title} ${pending.stage.label.toLowerCase()}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={loading} onClick={() => onConfirm(reason)}>
            Move to {pending.stage.label}
          </Button>
        </>
      }
    >
      <Field label="Why was it lost?">
        {(props) => <Textarea {...props} autoFocus rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Price, timing, went with a competitor …" />}
      </Field>
    </Dialog>
  );
}

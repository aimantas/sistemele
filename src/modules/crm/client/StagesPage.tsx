import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { useCan } from "@/app/lib/session";
import { Badge, Button, Card, Dialog, ErrorState, Field, FormError, IconButton, Input, PageHeader, Select, Spinner } from "@/app/ui";
import type { Stage } from "../shared/schema";
import { useDeleteStage, useReorderStages, useSaveStage, useStages } from "./api";
import { stageTone } from "./parts";

/** Pipeline → Stages: add, rename, reorder and remove open stages; rename won and lost. Owners and admins. */
export default function StagesPage() {
  const format = useFormat();
  const canEdit = useCan("admin");
  const stages = useStages();
  const reorder = useReorderStages();
  const [editing, setEditing] = useState<Stage | "new" | null>(null);
  const [deleting, setDeleting] = useState<Stage | null>(null);

  if (stages.isLoading) return <Spinner />;
  if (stages.error || !stages.data) return <ErrorState error={stages.error} retry={() => stages.refetch()} />;
  const open = stages.data.filter((stage) => stage.kind === "open");
  const move = (index: number, by: -1 | 1) => {
    const ids = open.map((stage) => stage.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={
          <Link to="/app/crm/pipeline" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Pipeline
          </Link>
        }
        title="Stages"
        actions={
          canEdit ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing("new")}>
              Add stage
            </Button>
          ) : null
        }
      />
      {!canEdit ? <p className="mb-4 text-sm text-muted">Owners and admins change stages.</p> : null}
      <Card>
        <ol className="divide-y divide-line">
          {stages.data.map((stage) => {
            const index = open.findIndex((item) => item.id === stage.id);
            return (
              <li key={stage.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {stage.label}
                    {stage.kind !== "open" && stage.label.toLowerCase() !== stage.kind ? <Badge tone={stageTone(stage.kind)}>{stage.kind}</Badge> : null}
                  </p>
                  <p className="tabular text-sm text-muted">
                    {format.vat(stage.probabilityBps)} win chance · {stage.dealCount} deal{stage.dealCount === 1 ? "" : "s"} · {format.money(stage.valueCents)}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    {stage.kind === "open" ? (
                      <>
                        <IconButton label={`Move ${stage.label} up`} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                          <ArrowUp />
                        </IconButton>
                        <IconButton label={`Move ${stage.label} down`} disabled={index === open.length - 1 || reorder.isPending} onClick={() => move(index, 1)}>
                          <ArrowDown />
                        </IconButton>
                      </>
                    ) : null}
                    <IconButton label={`Edit ${stage.label}`} onClick={() => setEditing(stage)}>
                      <Pencil />
                    </IconButton>
                    {stage.kind === "open" ? (
                      <IconButton label={`Remove ${stage.label}`} disabled={open.length <= 1} onClick={() => setDeleting(stage)}>
                        <Trash2 />
                      </IconButton>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>
      <FormError error={reorder.error} />
      {editing ? <StageDialog stage={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      {deleting ? <DeleteStageDialog stage={deleting} stages={stages.data} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}

function StageDialog({ stage, onClose }: { stage?: Stage; onClose: () => void }) {
  const save = useSaveStage(stage?.id);
  const [label, setLabel] = useState(stage?.label ?? "");
  const [percent, setPercent] = useState(String((stage?.probabilityBps ?? 5000) / 100));
  const fixed = stage && stage.kind !== "open";
  return (
    <Dialog
      open
      onClose={onClose}
      title={stage ? `Edit ${stage.label}` : "Add stage"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate({ label, probabilityBps: Math.round(Number(percent) * 100) }, { onSuccess: onClose })}>
            {stage ? "Save stage" : "Add stage"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name" error={fieldError(save.error, "label")}>
          {(props) => <Input {...props} autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Demo booked" />}
        </Field>
        <Field label="Win chance (%)" error={fieldError(save.error, "probabilityBps")} hint={fixed ? "Won is always 100%, lost 0%." : "Weights this stage in the weighted pipeline."}>
          {(props) => <Input {...props} type="number" min={0} max={100} step={1} inputMode="numeric" disabled={fixed} value={percent} onChange={(event) => setPercent(event.target.value)} className="w-32" />}
        </Field>
        <FormError error={save.error} />
      </div>
    </Dialog>
  );
}

function DeleteStageDialog({ stage, stages, onClose }: { stage: Stage; stages: Stage[]; onClose: () => void }) {
  const remove = useDeleteStage();
  const targets = stages.filter((item) => item.id !== stage.id);
  const [moveTo, setMoveTo] = useState(targets.find((item) => item.kind === "open")?.id ?? targets[0]?.id ?? "");
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Remove ${stage.label}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate({ id: stage.id, moveTo: stage.dealCount ? moveTo : undefined }, { onSuccess: onClose })}>
            Remove stage
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {stage.dealCount ? (
          <Field label={`Move its ${stage.dealCount} deal${stage.dealCount === 1 ? "" : "s"} to`} error={fieldError(remove.error, "moveTo")}>
            {(props) => (
              <Select {...props} value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <p className="text-ink-soft">The stage has no deals. Its history in the audit log stays.</p>
        )}
        <FormError error={remove.error} />
      </div>
    </Dialog>
  );
}

import { slugify } from "@/shared/slug";
import type { ModuleContext } from "@/modules/types.server";
import { AppError, conflict, notFound } from "@/worker/lib/errors";
import { stageDeleteSchema, stageInputSchema, stageOrderSchema, stagePatchSchema, type Stage, type StageInput, type StageKind } from "../shared/schema";

/**
 * Pipeline stages. Members read them; owners and admins change them.
 * Open stages come first in `position` order, then won, then lost.
 */

const MAX_OPEN_STAGES = 20;
const STAGE_SELECT = `SELECT s.id, s.label, s.kind, s.probability_bps AS probabilityBps, s.position,
  (SELECT COUNT(*) FROM deals d WHERE d.stage = s.id) AS dealCount,
  (SELECT COALESCE(SUM(d.value_cents), 0) FROM deals d WHERE d.stage = s.id) AS valueCents
  FROM pipeline_stages s`;
const STAGE_ORDER = "ORDER BY CASE s.kind WHEN 'open' THEN 0 WHEN 'won' THEN 1 ELSE 2 END, s.position, s.created_at";

const invalid = (field: string, message: string) => new AppError(422, "validation_failed", message, { [field]: message });

export async function listStages(ctx: ModuleContext): Promise<Stage[]> {
  ctx.requireRole("member");
  return allStages(ctx);
}

/** No role check: for services and event handlers that already checked. */
export function allStages(ctx: ModuleContext): Promise<Stage[]> {
  return ctx.db.all<Stage>(`${STAGE_SELECT} ${STAGE_ORDER}`);
}

async function findStage(ctx: ModuleContext, id: string): Promise<Stage | null> {
  return ctx.db.first<Stage>(`${STAGE_SELECT} WHERE s.id = ?`, [id]);
}

/** The stage a deal is moved or created in. Unknown ids are a 422 on `field`. */
export async function requireStage(ctx: ModuleContext, id: string, field = "stage"): Promise<Stage> {
  const stage = await findStage(ctx, id);
  if (!stage) throw invalid(field, "Choose a stage from the pipeline.");
  return stage;
}

export async function firstStageOfKind(ctx: ModuleContext, kind: StageKind): Promise<Stage> {
  const stage = await ctx.db.first<Stage>(`${STAGE_SELECT} WHERE s.kind = ? ${STAGE_ORDER} LIMIT 1`, [kind]);
  if (!stage) throw conflict(`The pipeline has no ${kind} stage. Add one in Pipeline → Stages.`);
  return stage;
}

export async function createStage(ctx: ModuleContext, raw: StageInput): Promise<Stage> {
  ctx.requireRole("admin");
  const input = stageInputSchema.parse(raw);
  const openCount = (await ctx.db.value<number>("SELECT COUNT(*) FROM pipeline_stages WHERE kind = 'open'")) ?? 0;
  if (openCount >= MAX_OPEN_STAGES) throw conflict(`A pipeline can have up to ${MAX_OPEN_STAGES} open stages.`);

  const base = slugify(input.label, "stage").slice(0, 50);
  let id = base;
  for (let n = 2; await ctx.db.value("SELECT id FROM pipeline_stages WHERE id = ?", [id]); n++) id = `${base}-${n}`;
  const position = ((await ctx.db.value<number>("SELECT MAX(position) FROM pipeline_stages WHERE kind = 'open'")) ?? 0) + 1;

  await ctx.db.run("INSERT INTO pipeline_stages (id, label, kind, probability_bps, position) VALUES (?, ?, 'open', ?, ?)", [id, input.label, input.probabilityBps, position]);
  await ctx.audit({ action: "stage.created", entityType: "stage", entityId: id, summary: `Added pipeline stage ${input.label}` });
  return requireStage(ctx, id);
}

/** Renames a stage or changes its probability. Won and lost keep 100% and 0%. */
export async function updateStage(ctx: ModuleContext, id: string, raw: Partial<StageInput>): Promise<Stage> {
  ctx.requireRole("admin");
  const patch = stagePatchSchema.parse(raw);
  const stage = await findStage(ctx, id);
  if (!stage) throw notFound("Stage");
  const probability = stage.kind === "open" ? (patch.probabilityBps ?? stage.probabilityBps) : stage.probabilityBps;
  await ctx.db.run("UPDATE pipeline_stages SET label = ?, probability_bps = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [patch.label ?? stage.label, probability, id]);
  await ctx.audit({ action: "stage.updated", entityType: "stage", entityId: id, summary: `Updated pipeline stage ${patch.label ?? stage.label}` });
  return requireStage(ctx, id);
}

/** Sets the order of the open stages. `ids` must list every open stage once. */
export async function reorderStages(ctx: ModuleContext, raw: { ids: string[] }): Promise<Stage[]> {
  ctx.requireRole("admin");
  const { ids } = stageOrderSchema.parse(raw);
  const open = (await allStages(ctx)).filter((stage) => stage.kind === "open").map((stage) => stage.id);
  if (ids.length !== open.length || new Set(ids).size !== ids.length || !ids.every((id) => open.includes(id))) {
    throw invalid("ids", "List every open stage exactly once.");
  }
  await ctx.db.batch(ids.map((id, index) => ctx.db.prepare("UPDATE pipeline_stages SET position = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [index + 1, id])));
  await ctx.audit({ action: "stage.reordered", entityType: "stage", summary: `Reordered pipeline stages: ${ids.join(", ")}` });
  return allStages(ctx);
}

/**
 * Removes an open stage. Its deals move to `moveTo` (required when it has
 * deals); won and lost stages and the last open stage cannot be removed.
 */
export async function deleteStage(ctx: ModuleContext, id: string, raw: { moveTo?: string } = {}): Promise<void> {
  ctx.requireRole("admin");
  const { moveTo } = stageDeleteSchema.parse(raw);
  const stage = await findStage(ctx, id);
  if (!stage) throw notFound("Stage");
  if (stage.kind !== "open") throw conflict("Won and lost stages stay. Rename them instead.");
  const openCount = (await ctx.db.value<number>("SELECT COUNT(*) FROM pipeline_stages WHERE kind = 'open'")) ?? 0;
  if (openCount <= 1) throw conflict("Keep at least one open stage.");

  const statements = [];
  if (stage.dealCount > 0) {
    if (!moveTo) throw invalid("moveTo", "Choose where its deals go.");
    if (moveTo === id) throw invalid("moveTo", "Choose another stage.");
    const target = await requireStage(ctx, moveTo, "moveTo");
    const base = (await ctx.db.value<number>("SELECT COALESCE(MAX(position), 0) FROM deals WHERE stage = ?", [target.id])) ?? 0;
    statements.push(
      ctx.db.prepare(
        `UPDATE deals SET stage = ?, position = ? + position, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           closed_at = CASE WHEN ? = 'open' THEN NULL ELSE COALESCE(closed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) END
         WHERE stage = ?`,
        [target.id, base, target.kind, id],
      ),
    );
  }
  statements.push(ctx.db.prepare("DELETE FROM pipeline_stages WHERE id = ?", [id]));
  await ctx.db.batch(statements);
  await ctx.audit({ action: "stage.deleted", entityType: "stage", entityId: id, summary: `Removed pipeline stage ${stage.label}${stage.dealCount ? `; ${stage.dealCount} deal(s) moved to ${moveTo}` : ""}` });
}

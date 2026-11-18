import type { Db } from "./db";
import { AppError } from "./errors";

/** A person records can be assigned to (lead, deal or task owner). */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

/** Active users, for owner pickers. Any signed-in member may read it. */
export function listTeam(db: Db): Promise<TeamMember[]> {
  return db.all<TeamMember>("SELECT id, COALESCE(NULLIF(name, ''), email) AS name, email FROM users WHERE status = 'active' ORDER BY name COLLATE NOCASE");
}

/**
 * Checks an owner id before it is saved. `null` (unassigned) passes.
 * `field` names the input field in the 422 response.
 */
export async function assertTeamMember(db: Db, userId: string | null, field = "ownerId"): Promise<void> {
  if (userId === null) return;
  const exists = await db.value<string>("SELECT id FROM users WHERE id = ? AND status = 'active'", [userId]);
  if (!exists) throw new AppError(422, "validation_failed", "Choose an active team member.", { [field]: "Choose an active team member." });
}

export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

/** True when `role` is at least `minimum` (owner > admin > member). */
export function roleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** "session" for the browser, "token" for API tokens used by agents and scripts. */
  via: "session" | "token";
}

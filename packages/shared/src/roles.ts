/** api-specs/01-conventions.md 1.11. Ordered inside a tenant; super_admin sits outside. */
export const ROLES = ["member", "head_of_team", "admin_tenant", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = {
  member: 1,
  head_of_team: 2,
  admin_tenant: 3,
  super_admin: 99,
};

/** A floor, not a set. Adding a role later does not require editing existing guards. */
export function hasRoleAtLeast(role: Role, floor: Role): boolean {
  if (role === "super_admin") return floor === "super_admin";
  if (floor === "super_admin") return false;
  return RANK[role] >= RANK[floor];
}

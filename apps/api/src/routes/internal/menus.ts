import type { Menu, Role } from "@archiva/shared";

/**
 * api-specs/02-authentication.md 2.4.
 * Derived from the role floor. AC-41.01 to AC-41.04.
 */
export function deriveMenus(role: Role): Menu[] {
  switch (role) {
    case "member":
      return ["dashboard", "document"];
    case "head_of_team":
      return ["dashboard", "document", "permission_category", "audit_trail", "analytics"];
    case "admin_tenant":
      return [
        "dashboard",
        "document",
        "permission_category",
        "audit_trail",
        "analytics",
        "configuration",
      ];
    case "super_admin":
      return ["tenant_management"];
  }
}

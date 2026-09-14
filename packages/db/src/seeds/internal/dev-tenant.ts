import type { configKey, userRole } from "../../schema/enums.ts";

export type SeedRole = (typeof userRole.enumValues)[number];
export type SeedConfigKey = (typeof configKey.enumValues)[number];

export type SeedUser = {
  /** Natural key. `users.email` is UNIQUE, so this is what a rerun conflicts on. */
  email: string;
  name: string;
  role: SeedRole;
};

export type SeedCategory = {
  /** Natural key with the tenant. `UNIQUE (tenant_id, name)`. */
  name: string;
  isSystem: boolean;
  /**
   * A category created through `createCategory` always starts inactive
   * (AC-45.01). That rule governs the service, not a fixture: two categories
   * are seeded active so a developer can exercise the download paths at all.
   */
  downloadActive: boolean;
};

export const DEV_TENANT = {
  name: "PT Archiva Demo",
  subdomain: "archiva-demo",
} as const;

/** Every seeded account shares this. Dev and QA only; never a deployed secret. */
export const DEV_PASSWORD = "archiva-dev-2026";

/**
 * Four users covering every role. `super_admin` carries no tenant: the CHECK
 * constraint on `users` rejects the row otherwise (06-data-model.md 6.4,
 * grooming D10), so a mistake here fails at insert rather than in a later test.
 */
export const DEV_USERS: SeedUser[] = [
  { email: "super@archiva.test", name: "Super Admin", role: "super_admin" },
  { email: "admin@archiva-demo.test", name: "Dewi Lestari", role: "admin_tenant" },
  { email: "ketua@archiva-demo.test", name: "Bagus Pratama", role: "head_of_team" },
  { email: "anggota@archiva-demo.test", name: "Siti Rahayu", role: "member" },
];

export const DEV_ADMIN_EMAIL = "admin@archiva-demo.test";

/**
 * Written explicitly rather than left to the service defaults, so AC-01.06's
 * "Admin Tenant telah menetapkan Max File Size sebesar 20 MB" is true of the
 * data and not only of a fallback. `storage_quota_gb` is Super Admin only and
 * lives on the tenant row, so it is not seeded here.
 */
export const DEV_CONFIG: { key: SeedConfigKey; value: string }[] = [
  { key: "max_file_size_mb", value: "20" },
  { key: "pending_confirmation_days", value: "7" },
];

/** `Uncategorized` is reserved and carries `is_system`. AC-06.03 files into it. */
export const DEV_CATEGORIES: SeedCategory[] = [
  { name: "Uncategorized", isSystem: true, downloadActive: false },
  { name: "Reporting", isSystem: false, downloadActive: true },
  { name: "Kontrak", isSystem: false, downloadActive: true },
  { name: "Keuangan", isSystem: false, downloadActive: false },
  { name: "Proposal", isSystem: false, downloadActive: false },
];

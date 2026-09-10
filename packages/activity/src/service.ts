import type { TenantId, UserId } from "@archiva/shared";
import type { Clock } from "./ports.ts";
import type { ActivityRepository } from "./repository.ts";

/**
 * technical-specs/06-data-model.md 6.9, plus the two additions flagged in
 * api-specs/_index.md open items 2 and 3. One generic shape from day one, so
 * adding an action costs a union member rather than a migration.
 */
export const AUDIT_ACTIONS = [
  "document.upload",
  "document.download",
  "document.download_bulk",
  "document.preview",
  "document.delete",
  "document.version_add",
  "category.create",
  "category.permission_change",
  "config.change",
  "ai.override",
  "auth.login",
  "auth.logout",
  "auth.login_failed",
  "admin.reset_state",
  "malware.detected",
  "tenant.create",
  "access.denied",
  "search.performed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditOutcome = "allowed" | "denied";

export type AuditEvent = {
  tenantId: TenantId;
  actorId: UserId | null;
  action: AuditAction;
  subjectType: string;
  subjectId: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
};

const LABELS: Record<AuditAction, string> = {
  "document.upload": "Unggahan",
  "document.download": "Unduhan",
  "document.download_bulk": "Unduhan massal",
  "document.preview": "Pratinjau",
  "document.delete": "Penghapusan",
  "document.version_add": "Versi baru",
  "category.create": "Kategori dibuat",
  "category.permission_change": "Perizinan diubah",
  "config.change": "Konfigurasi diubah",
  "ai.override": "Koreksi hasil AI",
  "auth.login": "Masuk",
  "auth.logout": "Keluar",
  "auth.login_failed": "Gagal masuk",
  "admin.reset_state": "Reset data",
  "malware.detected": "Malware terdeteksi",
  "tenant.create": "Tenant dibuat",
  "access.denied": "Akses ditolak",
  "search.performed": "Pencarian",
};

/** Outcome-aware. AC-13.02 asserts on the rendered string, so it is served. */
export function auditLabel(action: AuditAction, outcome: AuditOutcome): string {
  if (action === "document.download" && outcome === "denied") return "Unduhan ditolak";
  if (action === "document.download_bulk" && outcome === "denied") return "Unduhan ditolak";
  return LABELS[action];
}

export interface ActivityService {
  /** Never throws into the caller's path. A failure to audit is logged and
   *  alerted, but does not fail a download the user was entitled to. */
  record(event: AuditEvent): Promise<void>;
  listAudit(
    tenantId: TenantId,
    filter: { q?: string; action?: AuditAction[]; outcome?: AuditOutcome },
    page: { page: number; limit: number },
  ): Promise<{ total: number; rows: (AuditEvent & { id: string; createdAt: Date })[] }>;
  dashboard(tenantId: TenantId): Promise<Record<string, unknown>>;
}

export function createActivityService(_deps: {
  repository: ActivityRepository;
  clock: Clock;
}): ActivityService {
  throw new Error("SCAFFOLD: implement in BE-S5-04, BE-S5-05");
}

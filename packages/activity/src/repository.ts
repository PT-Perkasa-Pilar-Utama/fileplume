import type { TenantId } from "@archiva/shared";
import type { AuditAction, AuditEvent, AuditOutcome } from "./service.ts";

export interface ActivityRepository {
  append(event: AuditEvent & { createdAt: Date }): Promise<void>;
  list(
    tenantId: TenantId,
    filter: { q?: string; action?: AuditAction[]; outcome?: AuditOutcome },
    page: { page: number; limit: number },
  ): Promise<{ total: number; rows: (AuditEvent & { id: string; createdAt: Date })[] }>;
  readRollups(tenantId: TenantId): Promise<Record<string, number>>;
}

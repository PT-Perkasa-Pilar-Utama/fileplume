import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { TenantId } from "@archiva/shared";
import type { AuditAction, AuditEvent, AuditOutcome } from "./service.ts";

export interface ActivityRepository {
  append(tenantId: TenantId, event: AuditEvent & { createdAt: Date }): Promise<void>;
  list(
    tenantId: TenantId,
    filter: { q?: string; action?: AuditAction[]; outcome?: AuditOutcome },
    page: { page: number; limit: number },
  ): Promise<{ total: number; rows: (AuditEvent & { id: string; createdAt: Date })[] }>;
  readRollups(tenantId: TenantId): Promise<Record<string, number>>;
}

export function createDrizzleActivityRepository(db: Db): ActivityRepository {
  return {
    async append(tenantId, event) {
      await db.insert(schema.auditEvents).values({
        tenantId,
        actorId: event.actorId,
        action: event.action,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        outcome: event.outcome,
        metadata: event.metadata,
        createdAt: event.createdAt,
      });
    },
    async list() {
      throw new Error("SCAFFOLD: implement in BE-S5-04");
    },
    async readRollups() {
      throw new Error("SCAFFOLD: implement in BE-S5-05");
    },
  };
}

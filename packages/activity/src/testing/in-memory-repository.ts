import type { TenantId } from "@archiva/shared";
import type { ActivityRepository } from "../repository.ts";
import type { AuditEvent } from "../service.ts";

export type InMemoryActivityRepository = ActivityRepository & {
  events: (AuditEvent & { createdAt: Date })[];
  clear(): void;
};

export function inMemoryActivityRepository(
  initialEvents?: (AuditEvent & { createdAt: Date })[],
): InMemoryActivityRepository {
  const events = [...(initialEvents ?? [])];

  return {
    events,
    clear(): void {
      events.length = 0;
    },
    async append(tenantId: TenantId, event: AuditEvent & { createdAt: Date }): Promise<void> {
      events.push({ ...event, tenantId });
    },
    async list(): Promise<{
      total: number;
      rows: (AuditEvent & { id: string; createdAt: Date })[];
    }> {
      throw new Error("SCAFFOLD: implement in BE-S5-04");
    },
    async readRollups(): Promise<Record<string, number>> {
      throw new Error("SCAFFOLD: implement in BE-S5-05");
    },
  };
}

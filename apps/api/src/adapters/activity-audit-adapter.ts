import type { ActivityService } from "@archiva/activity";
import type { AuditPort } from "@archiva/catalog";

export function createActivityAuditAdapter(activity: ActivityService): AuditPort {
  return {
    async record(event) {
      await activity.record({
        tenantId: event.tenantId,
        actorId: event.actorId,
        action: event.action,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        outcome: event.outcome,
        metadata: event.metadata,
      });
    },
  };
}

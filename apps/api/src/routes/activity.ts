import { one } from "@archiva/shared";
import { getDashboard, listAuditEvents } from "./definitions/activity.ts";
import { listOf, MOCK_AUDIT_EVENT, MOCK_DASHBOARD } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/09-activity.md. Cards BE-S5-04, BE-S5-05. */
export const auditRoutes = createRouter().openapi(listAuditEvents, (c) =>
  c.json(listOf(MOCK_AUDIT_EVENT), 200),
);

export const analyticsRoutes = createRouter().openapi(getDashboard, (c) =>
  c.json(one(MOCK_DASHBOARD), 200),
);

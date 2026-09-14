import {
  analyticsDashboardSchema,
  auditEventSchema,
  auditEventsQuery,
  collectionOf,
  dataOf,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import { ERROR_422, GUARDED, json, SESSION } from "./responses.ts";

const tags = ["Activity"];

/** api-specs/09-activity.md 9.2. The ledger is append-only; nothing here writes. */
export const listAuditEvents = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "The audit trail",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  request: { query: auditEventsQuery },
  responses: {
    200: json(collectionOf(auditEventSchema), "A page of audit events"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 9.3. Fixed windows, read from rollups rather than raw events. */
export const getDashboard = createRoute({
  method: "get",
  path: "/dashboard",
  tags,
  summary: "Every analytics card in one read",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  responses: { 200: json(dataOf(analyticsDashboardSchema), "The dashboard"), ...GUARDED },
});

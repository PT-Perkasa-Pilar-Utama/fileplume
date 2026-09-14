import {
  healthReportSchema,
  livenessSchema,
  resetAcceptedSchema,
  resetJobParams,
  resetJobSchema,
  resetStateBody,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import {
  ERROR_401,
  ERROR_404,
  ERROR_409,
  ERROR_422,
  ERROR_429,
  HEALTH_TOKEN,
  json,
  jsonBody,
  RESET_TOKEN,
} from "./responses.ts";

const tags = ["System"];

/**
 * api-specs/10-system.md. Token guards are attached where the routers are
 * built, because the tokens come from configuration at startup.
 */
export const liveness = createRoute({
  method: "get",
  path: "/live",
  tags,
  summary: "Liveness; touches no dependency",
  responses: { 200: json(livenessSchema, "The process is serving") },
});

/** 10.3. `degraded` is 200; only `down` is 503. */
export const readiness = createRoute({
  method: "get",
  path: "/ready",
  tags,
  summary: "Readiness, with a per-dependency breakdown",
  security: HEALTH_TOKEN,
  responses: {
    200: json(healthReportSchema, "Overall status ok or degraded"),
    ...ERROR_401,
    503: json(healthReportSchema, "Overall status down"),
  },
});

/** 10.3. `GET /health` is an alias, left out of the document. */
export const readinessAlias = createRoute({ ...readiness, path: "/", hide: true });

/** 10.4. Registered only outside production. */
export const resetState = createRoute({
  method: "post",
  path: "/reset-state",
  tags,
  summary: "Drop, re-migrate, reseed and clear every downstream store",
  security: RESET_TOKEN,
  request: { body: jsonBody(resetStateBody) },
  responses: {
    202: json(resetAcceptedSchema, "The reset job was queued"),
    ...ERROR_401,
    ...ERROR_409,
    ...ERROR_422,
    ...ERROR_429,
  },
});

/** 10.5. */
export const resetJob = createRoute({
  method: "get",
  path: "/reset-state/{jobId}",
  tags,
  summary: "Progress for a reset job",
  security: RESET_TOKEN,
  request: { params: resetJobParams },
  responses: {
    200: json(resetJobSchema, "The job's stage and outcome"),
    ...ERROR_401,
    ...ERROR_404,
    ...ERROR_422,
  },
});

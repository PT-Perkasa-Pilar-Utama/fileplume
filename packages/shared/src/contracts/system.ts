import { z } from "zod";
import { timestampSchema } from "./common.ts";
import { PROBE_STATUSES, RESET_JOB_STATUSES, RESET_SEEDS, RESET_STAGES } from "./enums.ts";

/**
 * api-specs/10-system.md. Operational payloads sit at the top level, with no
 * `data` envelope, because the consumers are probes and scripts.
 */
export const livenessSchema = z
  .object({ status: z.literal("ok"), version: z.string() })
  .meta({ id: "Liveness" });

/** 10.3. A check may carry dependency-specific detail such as `queueDepth`. */
const probeResultSchema = z.looseObject({
  status: z.enum(PROBE_STATUSES),
  latencyMs: z.number().int().nonnegative().optional(),
});

export const healthReportSchema = z
  .object({
    status: z.enum(PROBE_STATUSES),
    version: z.string(),
    checks: z.record(z.string(), probeResultSchema),
  })
  .meta({ id: "HealthReport" });

/** 10.4. `confirm` must equal `reset-<APP_ENV>`; the service decides, so a mismatch is still audited. */
export const resetStateBody = z.object({
  seed: z.enum(RESET_SEEDS).optional(),
  confirm: z.string(),
});
export type ResetStateBody = z.infer<typeof resetStateBody>;

export const resetAcceptedSchema = z
  .object({
    jobId: z.uuid(),
    status: z.literal("queued"),
    seed: z.enum(RESET_SEEDS),
    statusUrl: z.string(),
  })
  .meta({ id: "ResetAccepted" });

export const resetJobParams = z.object({ jobId: z.uuid() });

/** 10.5. On failure, `stage` names where it stopped. */
export const resetJobSchema = z
  .object({
    jobId: z.uuid(),
    status: z.enum(RESET_JOB_STATUSES),
    stage: z.enum(RESET_STAGES).nullable(),
    stages: z.array(z.enum(RESET_STAGES)),
    startedAt: timestampSchema.nullable(),
    finishedAt: timestampSchema.nullable(),
    error: z.string().nullable(),
  })
  .meta({ id: "ResetJob" });

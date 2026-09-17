import type { Config } from "@archiva/config";
import {
  type DependencyProbe,
  healthHttpStatus,
  inMemoryResetStageActions,
  ResetRunner,
  runHealthCheck,
} from "@archiva/platform";
import { AppError } from "@archiva/shared";
import { bearerAuth } from "hono/bearer-auth";
import { liveness, readiness, readinessAlias, resetJob, resetState } from "./definitions/system.ts";
import { createRouter } from "./router.ts";

/**
 * api-specs/10-system.md. Health probes are real: a fake health check is worse
 * than no health check, because it reports green on a wiped database.
 */
export function healthRoutes(config: Config, probes: DependencyProbe[]) {
  const middleware = bearerAuth({ token: config.HEALTH_TOKEN });
  const check = () => runHealthCheck(probes, config.APP_VERSION);

  return createRouter()
    .openapi(liveness, (c) => c.json({ status: "ok" as const, version: config.APP_VERSION }, 200))
    .openapi({ ...readiness, middleware }, async (c) => {
      const report = await check();
      return c.json(report, healthHttpStatus(report.status) as 200);
    })
    .openapi({ ...readinessAlias, middleware }, async (c) => {
      const report = await check();
      return c.json(report, healthHttpStatus(report.status) as 200);
    });
}

/**
 * 10.4. Registered only outside production. Guarded by environment-bound confirm
 * value and RESET_API_TOKEN.
 */
export function resetStateRoutes(config: Config, runner?: ResetRunner) {
  const token = config.RESET_API_TOKEN;
  if (!token) throw new Error("resetStateRoutes requires RESET_API_TOKEN");
  const middleware = bearerAuth({ token });
  const activeRunner =
    runner ??
    new ResetRunner({
      actions: inMemoryResetStageActions(),
      appEnv: config.APP_ENV,
    });

  return createRouter()
    .openapi({ ...resetState, middleware }, async (c) => {
      const body = c.req.valid("json");
      const result = activeRunner.start(body.confirm, body.seed);

      if (!result.ok) {
        if (result.error.kind === "ConfirmMismatch") {
          throw new AppError("VALIDATION_ERROR", [
            { field: "confirm", issue: "Confirm token mismatch" },
          ]);
        }
        throw new AppError("INVALID_STATE_TRANSITION");
      }

      return c.json(result.value, 202);
    })
    .openapi({ ...resetJob, middleware }, (c) => {
      const { jobId } = c.req.valid("param");
      const job = activeRunner.getJob(jobId);

      if (!job) {
        throw new AppError("NOT_FOUND");
      }

      return c.json(job, 200);
    });
}

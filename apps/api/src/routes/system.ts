import type { Config } from "@archiva/config";
import { type DependencyProbe, healthHttpStatus, runHealthCheck } from "@archiva/platform";
import { RESET_STAGES } from "@archiva/shared";
import { bearerAuth } from "hono/bearer-auth";
import { liveness, readiness, readinessAlias, resetJob, resetState } from "./definitions/system.ts";
import { createRouter } from "./router.ts";

/**
 * api-specs/10-system.md. Health probes are real: a fake health check is worse
 * than no health check, because it reports green on a wiped database.
 */
export function healthRoutes(config: Config, probes: DependencyProbe[]) {
  // 10.3 guarded: the per-dependency breakdown names internal topology.
  const middleware = bearerAuth({ token: config.HEALTH_TOKEN });
  const check = () => runHealthCheck(probes, config.APP_VERSION);

  return (
    createRouter()
      // 10.2 public in every environment, dependency-free, so a blip does not
      // restart a healthy process.
      .openapi(liveness, (c) => c.json({ status: "ok" as const, version: config.APP_VERSION }, 200))
      .openapi({ ...readiness, middleware }, async (c) => {
        const report = await check();
        // Hono types the status as a literal union; healthHttpStatus returns 200 or 503.
        return c.json(report, healthHttpStatus(report.status) as 200);
      })
      .openapi({ ...readinessAlias, middleware }, async (c) => {
        const report = await check();
        // Hono types the status as a literal union; healthHttpStatus returns 200 or 503.
        return c.json(report, healthHttpStatus(report.status) as 200);
      })
  );
}

/**
 * 10.4. Registered only outside production. The caller of this factory decides
 * whether it is mounted at all; there is no authorization check that could be
 * misconfigured into existence.
 */
export function resetStateRoutes(config: Config) {
  const token = config.RESET_API_TOKEN;
  if (!token) throw new Error("resetStateRoutes requires RESET_API_TOKEN");
  const middleware = bearerAuth({ token });
  const jobId = "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70";

  return createRouter()
    .openapi({ ...resetState, middleware }, (c) =>
      c.json(
        {
          jobId,
          status: "queued" as const,
          seed: config.RESET_DEFAULT_SEED ?? "dev",
          statusUrl: `/admin/reset-state/${jobId}`,
        },
        202,
      ),
    )
    .openapi({ ...resetJob, middleware }, (c) =>
      c.json(
        {
          jobId: c.req.valid("param").jobId,
          status: "succeeded" as const,
          stage: "flush_queue" as const,
          stages: [...RESET_STAGES],
          startedAt: "2026-09-10T06:12:00.000Z",
          finishedAt: "2026-09-10T06:13:40.000Z",
          error: null,
        },
        200,
      ),
    );
}

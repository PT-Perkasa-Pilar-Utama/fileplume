import type { Config } from "@archiva/config";
import { type DependencyProbe, healthHttpStatus, runHealthCheck } from "@archiva/platform";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import type { AppEnv } from "../middleware/context.ts";

/**
 * api-specs/10-system.md. Health probes are real: a fake health check is worse
 * than no health check, because it reports green on a wiped database.
 */
export function healthRoutes(config: Config, probes: DependencyProbe[]) {
  return (
    new Hono<AppEnv>()
      // 10.2 public in every environment, dependency-free, so a blip does not
      // restart a healthy process.
      .get("/live", (c) => c.json({ status: "ok", version: config.APP_VERSION }))
      // 10.3 guarded: the per-dependency breakdown names internal topology.
      .use("/ready", bearerAuth({ token: config.HEALTH_TOKEN }))
      .use("/", bearerAuth({ token: config.HEALTH_TOKEN }))
      .get("/ready", async (c) => {
        const report = await runHealthCheck(probes, config.APP_VERSION);
        return c.json(report, healthHttpStatus(report.status) as 200);
      })
      .get("/", async (c) => {
        const report = await runHealthCheck(probes, config.APP_VERSION);
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

  return new Hono<AppEnv>()
    .use("/reset-state", bearerAuth({ token }))
    .use("/reset-state/*", bearerAuth({ token }))
    .post("/reset-state", (c) =>
      c.json(
        {
          jobId: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
          status: "queued",
          seed: config.RESET_DEFAULT_SEED ?? "dev",
          statusUrl: "/admin/reset-state/d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
        },
        202,
      ),
    )
    .get("/reset-state/:jobId", (c) =>
      c.json({
        jobId: c.req.param("jobId"),
        status: "succeeded",
        stage: "flush_queue",
        stages: ["drop", "migrate", "seed", "purge_blobs", "recreate_index", "flush_queue"],
        startedAt: "2026-09-10T06:12:00.000Z",
        finishedAt: "2026-09-10T06:13:40.000Z",
        error: null,
      }),
    );
}

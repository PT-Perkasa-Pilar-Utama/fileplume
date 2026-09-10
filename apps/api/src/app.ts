import type { Config } from "@archiva/config";
import type { DependencyProbe } from "@archiva/platform";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./middleware/context.ts";
import { errorHandler } from "./middleware/errors.ts";
import { resolveTenantAndSession } from "./middleware/guards.ts";
import { activityRoutesMount } from "./routes/index.ts";
import { healthRoutes, resetStateRoutes } from "./routes/system.ts";

export function createApp(config: Config, probes: DependencyProbe[] = []) {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);
  app.use("*", secureHeaders());
  app.use("/api/*", cors({ origin: config.WEB_ORIGIN, credentials: true }));

  app.route("/health", healthRoutes(config, probes));

  const api = new Hono<AppEnv>();
  api.use("*", resolveTenantAndSession);
  activityRoutesMount(api);
  app.route("/api/v1", api);

  /**
   * technical-specs/07-security.md 7.6.2. Enforced at route registration, not
   * by an authorization check inside a handler. In production the branch never
   * runs, the handler is never registered, and the path returns the same 404
   * as any unknown URL.
   */
  if (config.APP_ENV !== "production" && config.ENABLE_RESET_API) {
    app.route("/admin", resetStateRoutes(config));
  }

  return app;
}

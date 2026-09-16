import type { Config } from "@archiva/config";
import type { DependencyProbe } from "@archiva/platform";
import type { TenancyService } from "@archiva/tenancy";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import type { AppEnv } from "./middleware/context.ts";
import { errorHandler, notFound } from "./middleware/errors.ts";
import { jsonBodyLimit, originCheck, securityHeaders } from "./middleware/hardening.ts";
import {
  mountRateLimits,
  type RateLimitStoreFactory,
  resetStateLimit,
} from "./middleware/rate-limits.ts";
import { type RequestContextDeps, requestContext } from "./middleware/request-context.ts";
import { registerSecuritySchemes } from "./openapi.ts";
import { activityRoutesMount } from "./routes/index.ts";
import { createRouter } from "./routes/router.ts";
import { healthRoutes, resetStateRoutes } from "./routes/system.ts";

export type AppDeps = {
  tenancy: TenancyService;
  identity: RequestContextDeps["identity"];
  rateLimitStores: RateLimitStoreFactory;
  probes: DependencyProbe[];
};

export function createApp(config: Config, deps: AppDeps): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  app.onError(errorHandler);
  app.notFound(notFound);
  app.use("*", securityHeaders());
  app.use("/api/*", cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use("/api/*", originCheck(config.WEB_ORIGIN));
  app.use("/api/*", jsonBodyLimit());

  app.route("/health", healthRoutes(config, deps.probes));

  const api = createRouter();
  api.use(
    "*",
    requestContext({
      tenancy: deps.tenancy,
      identity: deps.identity,
      baseHost: config.TENANT_BASE_HOST,
    }),
  );
  mountRateLimits(api, deps.rateLimitStores);
  activityRoutesMount(api, { tenancy: deps.tenancy });
  app.route("/api/v1", api);

  /**
   * technical-specs/07-security.md 7.6.2. Enforced at route registration, not
   * by an authorization check inside a handler. In production the branch never
   * runs, the handler is never registered, and the path returns the same 404
   * as any unknown URL.
   */
  if (config.APP_ENV !== "production" && config.ENABLE_RESET_API) {
    app.post("/admin/reset-state", resetStateLimit(deps.rateLimitStores));
    app.route("/admin", resetStateRoutes(config));
  }

  registerSecuritySchemes(app);
  return app;
}

import { createActivityService, createDrizzleActivityRepository } from "@archiva/activity";
import { createCatalogService, createDrizzleCatalogRepository } from "@archiva/catalog";
import { loadConfig } from "@archiva/config";
import { createDb } from "@archiva/db";
import { createDrizzleIdentityRepository, createIdentityService } from "@archiva/identity";
import { ResetRunner } from "@archiva/platform";
import { createDrizzleTenancyRepository, createTenancyService } from "@archiva/tenancy";
import { RedisClient } from "bun";
import { createActivityAuditAdapter } from "./adapters/activity-audit-adapter.ts";
import { bunPasswordHasher } from "./adapters/bun-password-hasher.ts";
import { createDependencyProbes } from "./adapters/dependency-probes.ts";
import { nullJobQueue } from "./adapters/null-job-queue.ts";
import { createS3BlobStore } from "./adapters/s3-blob-store.ts";
import { systemClock } from "./adapters/system-clock.ts";
import { createSystemResetActions } from "./adapters/system-reset-actions.ts";
import { createTenancyQuotaAdapter } from "./adapters/tenancy-quota-adapter.ts";
import { createValkeyRateLimitStores } from "./adapters/valkey-rate-limit-store.ts";
import { createApp } from "./app.ts";

/** Composition root: builds adapters, wires modules, binds the port. */
const config = loadConfig();
const dbHandle = createDb({ url: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });
const redisClient = new RedisClient(config.VALKEY_URL);

const tenancy = createTenancyService({
  repository: createDrizzleTenancyRepository(dbHandle.db),
  clock: systemClock,
});
const identity = createIdentityService({
  repository: createDrizzleIdentityRepository(dbHandle.db),
  hasher: bunPasswordHasher,
  clock: systemClock,
  idleTtlHours: config.SESSION_IDLE_TTL_HOURS,
});
const activity = createActivityService({
  repository: createDrizzleActivityRepository(dbHandle.db),
  clock: systemClock,
});

const catalog = createCatalogService({
  repository: createDrizzleCatalogRepository(dbHandle.db),
  blobStore: createS3BlobStore({
    endpoint: config.S3_ENDPOINT,
    bucket: config.S3_BUCKET,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    region: config.S3_REGION,
  }),
  clock: systemClock,
  quota: createTenancyQuotaAdapter(tenancy),
  queue: nullJobQueue,
  audit: createActivityAuditAdapter(activity),
});

const probes = createDependencyProbes({ config, dbHandle, redisClient });
const resetRunner = config.ENABLE_RESET_API
  ? new ResetRunner({
      actions: createSystemResetActions({ config, dbHandle, redisClient }),
      appEnv: config.APP_ENV,
    })
  : undefined;

const app = createApp(config, {
  tenancy,
  identity,
  activity,
  catalog,
  rateLimitStores: createValkeyRateLimitStores(redisClient),
  probes,
  resetRunner,
});

export default { port: config.PORT, fetch: app.fetch };

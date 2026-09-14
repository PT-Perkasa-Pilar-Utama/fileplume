import { loadConfig } from "@archiva/config";
import { createDb } from "@archiva/db";
import { createDrizzleIdentityRepository, createIdentityService } from "@archiva/identity";
import { createDrizzleTenancyRepository, createTenancyService } from "@archiva/tenancy";
import { RedisClient } from "bun";
import { bunPasswordHasher } from "./adapters/bun-password-hasher.ts";
import { systemClock } from "./adapters/system-clock.ts";
import { createValkeyRateLimitStores } from "./adapters/valkey-rate-limit-store.ts";
import { createApp } from "./app.ts";

/** Composition root: builds adapters, wires modules, binds the port. */
const config = loadConfig();
const { db } = createDb({ url: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });

const tenancy = createTenancyService({
  repository: createDrizzleTenancyRepository(db),
  clock: systemClock,
});
const identity = createIdentityService({
  repository: createDrizzleIdentityRepository(db),
  hasher: bunPasswordHasher,
  clock: systemClock,
  idleTtlHours: config.SESSION_IDLE_TTL_HOURS,
});

const app = createApp(config, {
  tenancy,
  identity,
  rateLimitStores: createValkeyRateLimitStores(new RedisClient(config.VALKEY_URL)),
  // SCAFFOLD: real dependency probes are built in BE-S1-04, one per row of
  // api-specs/10-system.md 10.3.
  probes: [],
});

export default { port: config.PORT, fetch: app.fetch };

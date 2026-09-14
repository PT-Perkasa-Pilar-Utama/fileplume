import type { Config } from "@archiva/config";
import type { SeededSession } from "@archiva/identity";
import {
  createIdentityService,
  inMemoryIdentityRepository,
  SESSION_COOKIE_NAME,
} from "@archiva/identity";
import type { Role } from "@archiva/shared";
import { asSessionId, asTenantId, asUserId } from "@archiva/shared";
import type { Tenant } from "@archiva/tenancy";
import { createTenancyService, inMemoryTenancyRepository } from "@archiva/tenancy";
import type { Hono } from "hono";
import { MemoryStore } from "hono-rate-limiter";
import { createApp } from "../app.ts";
import type { AppEnv } from "../middleware/context.ts";

export const BASE_CONFIG: Config = {
  APP_ENV: "dev",
  NODE_ENV: "development",
  PORT: 3000,
  LOG_LEVEL: "debug",
  WEB_ORIGIN: "http://localhost:5173",
  TENANT_BASE_HOST: "localhost",
  APP_VERSION: "test",
  DATABASE_URL: "postgres://x@localhost:5432/x",
  DATABASE_POOL_MAX: 10,
  VALKEY_URL: "redis://localhost:6379",
  OPENSEARCH_URL: "http://localhost:9200",
  OPENSEARCH_USERNAME: "admin",
  OPENSEARCH_PASSWORD: "x",
  OPENSEARCH_INDEX_PREFIX: "archiva-test",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "archiva",
  S3_ACCESS_KEY_ID: "x",
  S3_SECRET_ACCESS_KEY: "x",
  S3_FORCE_PATH_STYLE: true,
  CLAMAV_HOST: "localhost",
  CLAMAV_PORT: 3310,
  GOTENBERG_URL: "http://localhost:3001",
  AI_PROVIDER: "stub",
  AI_MODEL_CLASSIFY: "claude-sonnet-5",
  AI_MODEL_TAG: "claude-haiku-4-5-20251001",
  AI_DAILY_TOKEN_BUDGET: 1000,
  OCR_PROVIDER: "fixture",
  AUTH_SECRET: "0123456789012345678901234567890123",
  SESSION_ABSOLUTE_TTL_DAYS: 30,
  SESSION_IDLE_TTL_HOURS: 8,
  ENABLE_RESET_API: true,
  RESET_API_TOKEN: "dev-reset-token",
  RESET_DEFAULT_SEED: "dev",
  HEALTH_TOKEN: "dev-health-token",
  OTEL_TRACES_SAMPLER_ARG: 1,
  WORKER_CONCURRENCY: 4,
  WORKER_MAX_ATTEMPTS: 3,
  WORKER_BACKOFF_MS: 5000,
};

export const TENANT_A: Tenant = {
  id: asTenantId("1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b"),
  name: "PT Contoh Baru",
  subdomain: "contohbaru",
  status: "active",
};

export const TENANT_B: Tenant = {
  id: asTenantId("5b4a3f2e-1d0c-4b9a-8f7e-6d5c4b3a2f10"),
  name: "PT Mitra Rahasia",
  subdomain: "mitra-rahasia",
  status: "active",
};

export const TOKENS = {
  memberA: "token-member-a",
  adminA: "token-admin-a",
  memberB: "token-member-b",
  superAdmin: "token-super-admin",
  idleA: "token-idle-a",
} as const;

const NOW = new Date("2026-09-14T08:00:00.000Z");

function seeded(token: string, role: Role, tenant: Tenant | null, lastSeenAt = NOW): SeededSession {
  const id = crypto.randomUUID();
  return {
    token,
    row: {
      id,
      expiresAt: new Date("2026-10-14T08:00:00.000Z"),
      lastSeenAt,
      principal: {
        userId: asUserId(crypto.randomUUID()),
        tenantId: tenant?.id ?? null,
        role,
        sessionId: asSessionId(id),
      },
    },
  };
}

/** A fresh app per call, so limiter windows never leak between tests. */
export function buildTestApp(config: Config = BASE_CONFIG): Hono<AppEnv> {
  const clock = { now: () => NOW };
  const tenancy = createTenancyService({
    repository: inMemoryTenancyRepository({ tenants: [TENANT_A, TENANT_B] }),
    clock,
  });
  const identity = createIdentityService({
    repository: inMemoryIdentityRepository({
      sessions: [
        seeded(TOKENS.memberA, "member", TENANT_A),
        seeded(TOKENS.adminA, "admin_tenant", TENANT_A),
        seeded(TOKENS.memberB, "member", TENANT_B),
        seeded(TOKENS.superAdmin, "super_admin", null),
        seeded(TOKENS.idleA, "member", TENANT_A, new Date("2026-09-13T08:00:00.000Z")),
      ],
    }),
    hasher: { verify: async () => false, hash: async () => "unused" },
    clock,
    idleTtlHours: config.SESSION_IDLE_TTL_HOURS,
  });

  return createApp(config, {
    tenancy,
    identity,
    rateLimitStores: () => new MemoryStore<AppEnv>(),
    probes: [],
  });
}

type RequestOptions = {
  subdomain?: string;
  token?: string;
  method?: string;
  /** Sent on mutating requests. Defaults to WEB_ORIGIN; null omits the header. */
  origin?: string | null;
  headers?: Record<string, string>;
  body?: string;
};

export function tenantRequest(path: string, options: RequestOptions = {}): Request {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  if (options.token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${options.token}`);
  }
  if (method !== "GET" && options.origin !== null) {
    headers.set("origin", options.origin ?? BASE_CONFIG.WEB_ORIGIN);
  }
  const host = `${options.subdomain ?? TENANT_A.subdomain}.${BASE_CONFIG.TENANT_BASE_HOST}`;
  return new Request(`http://${host}/api/v1${path}`, { method, headers, body: options.body });
}

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };

export async function errorOf(res: Response): Promise<ErrorBody["error"]> {
  // Typed test fixture: the envelope shape is asserted by the caller.
  return ((await res.json()) as ErrorBody).error;
}

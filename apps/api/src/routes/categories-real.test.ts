import { afterAll, beforeAll, expect, test } from "bun:test";
import { createActivityService, createDrizzleActivityRepository } from "@archiva/activity";
import { createCatalogService, inMemoryBlobStore } from "@archiva/catalog";
import {
  createClassificationService,
  createDrizzleClassificationRepository,
} from "@archiva/classification";
import { createDb, type Db, runMigrations, schema } from "@archiva/db";
import { createDrizzleIdentityRepository, createIdentityService } from "@archiva/identity";
import { hashSessionToken } from "@archiva/shared";
import { createDrizzleTenancyRepository, createTenancyService } from "@archiva/tenancy";
import { MemoryStore } from "hono-rate-limiter";
import { GenericContainer, Wait } from "testcontainers";
import { createActivityAuditAdapter } from "../adapters/activity-audit-adapter.ts";
import { createIdentitySessionAdapter } from "../adapters/identity-session-adapter.ts";
import { nullJobQueue } from "../adapters/null-job-queue.ts";
import { createTenancyQuotaAdapter } from "../adapters/tenancy-quota-adapter.ts";
import { createApp } from "../app.ts";
import type { AppEnv } from "../middleware/context.ts";
import { BASE_CONFIG, buildTestApp } from "../testing/test-app.ts";

let db: Db;
let stop: () => Promise<void>;
beforeAll(async () => {
  const container = await new GenericContainer(
    "postgres:17.2@sha256:3267c505060a0052e5aa6e5175a7b41ab6b04da2f8c4540fc6e98a37210aa2d3",
  )
    .withEnvironment({
      POSTGRES_PASSWORD: "fixture",
      POSTGRES_USER: "fixture",
      POSTGRES_DB: "fixture",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
    .start();
  const handle = createDb({
    url: `postgres://fixture:fixture@${container.getHost()}:${container.getMappedPort(5432)}/fixture`,
    max: 4,
  });
  db = handle.db;
  await runMigrations(db);
  stop = async () => {
    await handle.client.close();
    await container.stop();
  };
}, 120_000);
afterAll(async () => {
  if (stop) await stop();
});

test("real HTTP category endpoints enforce tenant scope and permissions", async () => {
  const tenants = await db
    .insert(schema.tenants)
    .values([
      { name: "Tenant A", subdomain: "alpha", storageQuotaBytes: 100 },
      { name: "Tenant B", subdomain: "beta", storageQuotaBytes: 100 },
    ])
    .returning();
  const a = tenants[0];
  const b = tenants[1];
  if (!a || !b) throw new Error("missing tenants");
  const users = await db
    .insert(schema.users)
    .values([
      {
        tenantId: a.id,
        name: "Head A",
        email: "head-a@example.test",
        passwordHash: "fixture",
        role: "head_of_team",
      },
      {
        tenantId: b.id,
        name: "Head B",
        email: "head-b@example.test",
        passwordHash: "fixture",
        role: "head_of_team",
      },
      {
        tenantId: a.id,
        name: "Member A",
        email: "member-a@example.test",
        passwordHash: "fixture",
        role: "member",
      },
    ])
    .returning();
  const headA = users[0];
  const headB = users[1];
  const member = users[2];
  if (!headA || !headB || !member) throw new Error("missing users");
  const now = new Date();
  await db.insert(schema.sessions).values(
    [headA, headB, member].map((user, i) => ({
      userId: user.id,
      tokenHash: hashSessionToken(`test-token-${i}`),
      expiresAt: new Date(now.getTime() + 86400000),
      lastSeenAt: now,
    })),
  );
  const clock = { now: () => new Date() };
  const fixture = buildTestApp();
  const tenancy = createTenancyService({ repository: createDrizzleTenancyRepository(db), clock });
  const identity = createIdentityService({
    repository: createDrizzleIdentityRepository(db),
    hasher: { verify: async () => false, hash: async () => "fixture" },
    clock,
    idleTtlHours: 8,
  });
  const activity = createActivityService({
    repository: createDrizzleActivityRepository(db),
    clock,
  });
  const catalog = createCatalogService({
    repository: fixture.catalogRepository,
    blobStore: inMemoryBlobStore(),
    clock,
    quota: createTenancyQuotaAdapter(tenancy),
    queue: nullJobQueue,
    audit: createActivityAuditAdapter(activity),
    session: createIdentitySessionAdapter(identity),
  });
  const app = createApp(BASE_CONFIG, {
    tenancy,
    identity,
    activity,
    catalog,
    classification: createClassificationService({
      repository: createDrizzleClassificationRepository(db),
      clock,
    }),
    rateLimitStores: () => new MemoryStore<AppEnv>(),
    probes: [],
  });
  const server = Bun.serve({ port: 0, fetch: app.fetch });
  try {
    const call = (host: string, token: string, method: string, path: string, body?: object) =>
      fetch(`http://127.0.0.1:${server.port}/api/v1${path}`, {
        method,
        headers: {
          host: `${host}.localhost`,
          origin: BASE_CONFIG.WEB_ORIGIN,
          cookie: `__Host-archiva_session=${token}`,
          "content-type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const created = await call("alpha", "test-token-0", "POST", "/categories", {
      name: "Reporting",
    });
    expect(created.status).toBe(201);
    const payload = await created.json();
    expect(payload.data.downloadActive).toBe(false);
    expect(payload.data.createdBy).toEqual({ id: headA.id, name: headA.name });
    expect(payload.data.permissionUpdatedBy).toEqual({ id: headA.id, name: headA.name });
    expect(Number.isNaN(Date.parse(payload.data.permissionUpdatedAt))).toBe(false);
    const duplicate = await call("alpha", "test-token-0", "POST", "/categories", {
      name: "reporting",
    });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.message).toBe("Kategori dengan nama tersebut sudah ada");
    expect(
      (await call("alpha", "test-token-2", "POST", "/categories", { name: "No" })).status,
    ).toBe(403);
    expect(
      (
        await call("beta", "test-token-1", "PATCH", `/categories/${payload.data.id}`, {
          name: "No",
        })
      ).status,
    ).toBe(404);
    const listed = await call("alpha", "test-token-2", "GET", "/categories");
    const listedBody = await listed.json();
    expect(listedBody.data).toHaveLength(1);
    expect(listedBody.data[0].permissionUpdatedBy).toEqual(payload.data.permissionUpdatedBy);
    expect(listedBody.data[0].permissionUpdatedAt).toBe(payload.data.permissionUpdatedAt);
    const [systemCategory] = await db
      .insert(schema.categories)
      .values({ tenantId: a.id, name: "Uncategorized", isSystem: true, createdBy: headA.id })
      .returning();
    if (!systemCategory) throw new Error("missing system category");
    await db.insert(schema.categoryPermissions).values({
      tenantId: a.id,
      categoryId: systemCategory.id,
      downloadActive: false,
      updatedBy: headA.id,
    });
    const systemList = await call("alpha", "test-token-2", "GET", "/categories?q=uncategorized");
    const systemBody = await systemList.json();
    expect(systemList.status).toBe(200);
    expect(systemBody.data).toHaveLength(1);
    expect(systemBody.data[0].isSystem).toBe(true);
    expect(systemBody.data[0].createdBy).toBeNull();
    const renamed = await call("alpha", "test-token-0", "PATCH", `/categories/${payload.data.id}`, {
      name: "Reports",
    });
    expect(renamed.status).toBe(200);
    const renamedBody = await renamed.json();
    expect(renamedBody.data.name).toBe("Reports");
    expect(renamedBody.data.downloadActive).toBe(false);
    const collision = await call(
      "alpha",
      "test-token-0",
      "PATCH",
      `/categories/${payload.data.id}`,
      {
        name: "uncategorized",
      },
    );
    expect(collision.status).toBe(409);
    const renameSystem = await call(
      "alpha",
      "test-token-0",
      "PATCH",
      `/categories/${systemCategory.id}`,
      { name: "Other" },
    );
    expect(renameSystem.status).toBe(422);
    expect((await renameSystem.json()).error.code).toBe("SYSTEM_CATEGORY_IMMUTABLE");
    const audits = await db.select().from(schema.auditEvents);
    expect(
      audits.some(
        (event) =>
          event.action === "access.denied" &&
          event.tenantId === a.id &&
          event.actorId === member.id &&
          event.outcome === "denied",
      ),
    ).toBe(true);
    expect(
      audits.some(
        (event) =>
          event.action === "access.denied" &&
          event.tenantId === b.id &&
          event.actorId === headB.id &&
          event.outcome === "denied" &&
          event.metadata?.attemptedId === payload.data.id,
      ),
    ).toBe(true);
  } finally {
    server.stop(true);
  }
});

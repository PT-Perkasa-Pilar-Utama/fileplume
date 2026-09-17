import { describe, expect, test } from "bun:test";
import { asTenantId, asUserId } from "@archiva/shared";
import { ANALYTICS_METRICS, AUDIT_ACTIONS, auditLabel, createActivityService } from "./service.ts";
import { inMemoryActivityRepository } from "./testing/in-memory-repository.ts";

describe("audit labels", () => {
  test("a denied download renders the exact criterion string", () => {
    // AC-13.02 asserts on "Unduhan ditolak".
    expect(auditLabel("document.download", "denied")).toBe("Unduhan ditolak");
  });

  test("an allowed download does not", () => {
    expect(auditLabel("document.download", "allowed")).toBe("Unduhan");
  });

  test("every action has a label", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(auditLabel(action, "allowed").length).toBeGreaterThan(0);
    }
  });
});

describe("audit action enum", () => {
  test("carries the two members the criteria need but the data model lacks", () => {
    // api-specs/_index.md open items 2 and 3.
    expect(AUDIT_ACTIONS).toContain("access.denied");
    expect(AUDIT_ACTIONS).toContain("search.performed");
  });

  test("analytics metrics contains documented keys", () => {
    expect(ANALYTICS_METRICS).toContain("documents_total");
    expect(ANALYTICS_METRICS).toContain("searches_performed");
  });
});

describe("activity service", () => {
  const tenantId = asTenantId("1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b");
  const actorId = asUserId("9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10");
  const fixedDate = new Date("2026-09-17T10:00:00.000Z");
  const clock = { now: () => fixedDate };

  test("records an audit event with tenantId and createdAt", async () => {
    const repository = inMemoryActivityRepository();
    const service = createActivityService({ repository, clock });

    await service.record({
      tenantId,
      actorId,
      action: "access.denied",
      subjectType: "route",
      subjectId: null,
      outcome: "denied",
      metadata: { path: "/api/v1/categories" },
    });

    expect(repository.events).toHaveLength(1);
    const event = repository.events[0];
    expect(event).toBeDefined();
    expect(event?.tenantId).toBe(tenantId);
    expect(event?.actorId).toBe(actorId);
    expect(event?.action).toBe("access.denied");
    expect(event?.outcome).toBe("denied");
    expect(event?.createdAt).toEqual(fixedDate);
    expect(event?.metadata).toEqual({ path: "/api/v1/categories" });
  });

  test("record never throws into the caller path when repository throws", async () => {
    // technical-specs/05-module-definitions.md 5.7 invariant 4:
    // record never throws into the caller's path.
    const failingRepo = {
      append: async () => {
        throw new Error("database unreachable");
      },
      list: async () => {
        throw new Error("unimplemented");
      },
      readRollups: async () => {
        throw new Error("unimplemented");
      },
    };
    const service = createActivityService({ repository: failingRepo, clock });

    // Must resolve cleanly without throwing
    await expect(
      service.record({
        tenantId,
        actorId: null,
        action: "access.denied",
        subjectType: "route",
        subjectId: null,
        outcome: "denied",
      }),
    ).resolves.toBeUndefined();
  });

  test("scaffold methods throw", async () => {
    const repository = inMemoryActivityRepository();
    const service = createActivityService({ repository, clock });

    expect(service.listAudit(tenantId, {}, { page: 1, limit: 10 })).rejects.toThrow("SCAFFOLD");
    expect(service.dashboard(tenantId)).rejects.toThrow("SCAFFOLD");
  });

  test("inMemoryActivityRepository clear empties the recorded events", async () => {
    const repository = inMemoryActivityRepository();
    await repository.append(tenantId, {
      tenantId,
      actorId: null,
      action: "access.denied",
      subjectType: "route",
      subjectId: null,
      outcome: "denied",
      createdAt: fixedDate,
    });
    expect(repository.events).toHaveLength(1);
    repository.clear();
    expect(repository.events).toHaveLength(0);
  });
});

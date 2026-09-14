import { describe, expect, test } from "bun:test";
import { asSessionId, asTenantId, asUserId } from "@archiva/shared";
import { createIdentityService } from "./service.ts";
import { inMemoryIdentityRepository } from "./testing/in-memory-repository.ts";

const NOW = new Date("2026-09-14T08:00:00.000Z");
const HOUR_MS = 3_600_000;
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

const principal = {
  userId: asUserId("22222222-2222-4222-8222-222222222222"),
  tenantId: asTenantId("11111111-1111-4111-8111-111111111111"),
  role: "member" as const,
  sessionId: asSessionId(SESSION_ID),
};

function build(times: { expiresAt: Date; lastSeenAt: Date }) {
  const repository = inMemoryIdentityRepository({
    sessions: [{ token: "raw-token", row: { id: SESSION_ID, principal, ...times } }],
  });
  const service = createIdentityService({
    repository,
    hasher: { verify: async () => false, hash: async () => "unused" },
    clock: { now: () => NOW },
    idleTtlHours: 8,
  });
  return { repository, service };
}

const fresh = { expiresAt: new Date(NOW.getTime() + 24 * HOUR_MS), lastSeenAt: NOW };

describe("resolveSession", () => {
  test("a live session resolves to its principal and is touched", async () => {
    const { repository, service } = build(fresh);
    const result = await service.resolveSession("raw-token");
    expect(result).toEqual({ ok: true, value: principal });
    expect(repository.lastSeen.get(SESSION_ID)).toEqual(NOW);
  });

  test("an unknown token is SessionRevoked", async () => {
    const { service } = build(fresh);
    expect(await service.resolveSession("other-token")).toEqual({
      ok: false,
      error: { kind: "SessionRevoked" },
    });
  });

  test("a session past its absolute expiry is SessionExpired", async () => {
    const { service } = build({ ...fresh, expiresAt: new Date(NOW.getTime() - 1) });
    expect(await service.resolveSession("raw-token")).toEqual({
      ok: false,
      error: { kind: "SessionExpired" },
    });
  });

  test("a session idle past eight hours is SessionExpired", async () => {
    // AC-40.04: evaluated on read, never by a sweeper.
    const { service } = build({ ...fresh, lastSeenAt: new Date(NOW.getTime() - 8 * HOUR_MS - 1) });
    const result = await service.resolveSession("raw-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("SessionExpired");
  });
});

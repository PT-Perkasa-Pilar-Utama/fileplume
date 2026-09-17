import { describe, expect, test } from "bun:test";
import { asSessionId, asTenantId, asUserId } from "@archiva/shared";
import type { Principal } from "./ports.ts";
import type { UserRow } from "./repository.ts";
import { createIdentityService } from "./service.ts";
import { inMemoryIdentityRepository } from "./testing/in-memory-repository.ts";

const NOW = new Date("2026-09-14T08:00:00.000Z");
const HOUR_MS = 3_600_000;
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const freshTimes = { expiresAt: new Date(NOW.getTime() + 24 * HOUR_MS), lastSeenAt: NOW };

const principal: Principal = {
  userId: asUserId(USER_ID),
  tenantId: asTenantId(TENANT_ID),
  role: "member",
  sessionId: asSessionId(SESSION_ID),
  name: "Budi Santoso",
  email: "budi@contohbaru.co.id",
  avatarUrl: null,
  expiresAt: freshTimes.expiresAt,
};

const userRow: UserRow = {
  id: USER_ID,
  tenantId: TENANT_ID,
  email: "budi@contohbaru.co.id",
  passwordHash: "hash-secret",
  name: "Budi Santoso",
  role: "member",
  avatarUrl: null,
};

const superAdminRow: UserRow = {
  id: "44444444-4444-4444-8444-444444444444",
  tenantId: null,
  email: "super@archiva.id",
  passwordHash: "hash-admin-secret",
  name: "Super Admin",
  role: "super_admin",
  avatarUrl: null,
};

function build(
  times: { expiresAt: Date; lastSeenAt: Date },
  users: UserRow[] = [userRow, superAdminRow],
) {
  const clock = { now: () => NOW };
  const repository = inMemoryIdentityRepository(
    {
      users,
      sessions: [{ token: "raw-token", row: { id: SESSION_ID, principal, ...times } }],
    },
    { clock },
  );
  let dummyVerified = false;
  const hasher = {
    verify: async (password: string, hash: string) => {
      if (hash === repository.dummyHash()) dummyVerified = true;
      return hash === `hash-${password}`;
    },
    hash: async (password: string) => `hash-${password}`,
  };
  const service = createIdentityService({
    repository,
    hasher,
    clock,
    idleTtlHours: 8,
  });
  return { repository, service, wasDummyVerified: () => dummyVerified };
}

describe("authenticate", () => {
  // AC-40.01: Login dengan kredensial yang valid
  test("valid email, password, and tenant issues a session", async () => {
    const { service } = build(freshTimes);
    const result = await service.authenticate("budi@contohbaru.co.id", "secret", TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.principal.userId).toBe(asUserId(USER_ID));
      expect(result.value.principal.tenantId).toBe(asTenantId(TENANT_ID));
      expect(result.value.principal.role).toBe("member");
      expect(result.value.principal.name).toBe("Budi Santoso");
      expect(result.value.token).toBeDefined();
    }
  });

  // AC-40.01: Super Admin login sits outside tenant (tenantId is null)
  test("super_admin logs in with null tenantId", async () => {
    const { service } = build(freshTimes);
    const result = await service.authenticate("super@archiva.id", "admin-secret", null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.principal.role).toBe("super_admin");
      expect(result.value.principal.tenantId).toBeNull();
    }
  });

  // AC-40.02: Login dengan kredensial yang salah (Negative Path)
  test("wrong password returns InvalidCredentials", async () => {
    const { service } = build(freshTimes);
    const result = await service.authenticate("budi@contohbaru.co.id", "wrong-password", TENANT_ID);
    expect(result).toEqual({ ok: false, error: { kind: "InvalidCredentials" } });
  });

  // AC-40.02: Timing attack prevention - unknown email verifies against dummyHash
  test("unknown email verifies against dummy hash and returns InvalidCredentials", async () => {
    const { service, wasDummyVerified } = build(freshTimes);
    const result = await service.authenticate("unknown@contohbaru.co.id", "secret", TENANT_ID);
    expect(result).toEqual({ ok: false, error: { kind: "InvalidCredentials" } });
    expect(wasDummyVerified()).toBe(true);
  });

  // AC-40.02: User of another tenant attempting to log in on this tenant returns InvalidCredentials
  test("user from another tenant returns InvalidCredentials", async () => {
    const { service } = build(freshTimes);
    const otherTenantId = "99999999-9999-4999-8999-999999999999";
    const result = await service.authenticate("budi@contohbaru.co.id", "secret", otherTenantId);
    expect(result).toEqual({ ok: false, error: { kind: "InvalidCredentials" } });
  });
});

describe("resolveSession", () => {
  test("a live session resolves to its principal and is touched", async () => {
    const { repository, service } = build(freshTimes);
    const result = await service.resolveSession("raw-token");
    expect(result).toEqual({ ok: true, value: principal });
    expect(repository.lastSeen.get(SESSION_ID)).toEqual(NOW);
  });

  test("an unknown token is SessionRevoked", async () => {
    const { service } = build(freshTimes);
    expect(await service.resolveSession("other-token")).toEqual({
      ok: false,
      error: { kind: "SessionRevoked" },
    });
  });

  test("a session past its absolute expiry is SessionExpired", async () => {
    const { service } = build({ ...freshTimes, expiresAt: new Date(NOW.getTime() - 1) });
    expect(await service.resolveSession("raw-token")).toEqual({
      ok: false,
      error: { kind: "SessionExpired" },
    });
  });

  test("a session idle past eight hours is SessionExpired", async () => {
    // AC-40.04: Sesi berakhir karena tidak aktif - evaluated on read, never by a sweeper
    const { service } = build({
      ...freshTimes,
      lastSeenAt: new Date(NOW.getTime() - 8 * HOUR_MS - 1),
    });
    const result = await service.resolveSession("raw-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("SessionExpired");
  });
});

describe("endSession", () => {
  // AC-40.03: Logout dari sistem
  test("endSession deletes the session row so subsequent resolution fails", async () => {
    const { service } = build(freshTimes);
    await service.endSession(SESSION_ID);
    expect(await service.resolveSession("raw-token")).toEqual({
      ok: false,
      error: { kind: "SessionRevoked" },
    });
  });
});

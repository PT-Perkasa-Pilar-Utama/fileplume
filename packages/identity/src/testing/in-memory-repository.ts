import { asSessionId, asTenantId, asUserId, hashSessionToken } from "@archiva/shared";
import type { Clock, Principal } from "../ports.ts";
import type { IdentityRepository, SessionRow, UserRow } from "../repository.ts";
import type { Session } from "../service.ts";

export type SeededSession = { token: string; row: SessionRow };

const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQAAAAAAAAAAA$Q29ycmVjdEhhc2hGb3JUaW1pbmdBdHRhY2tzAAAAAA";

/**
 * Ships with the module so every module is importable in a test with no
 * network, no container and no environment variables. Sessions are keyed by
 * token hash, as the table is.
 */
export function inMemoryIdentityRepository(
  initial: { users?: UserRow[]; sessions?: SeededSession[] } = {},
  options?: { clock?: Clock; absoluteTtlDays?: number },
): IdentityRepository & { lastSeen: Map<string, Date> } {
  const users = initial.users ?? [];
  const sessions = new Map(
    (initial.sessions ?? []).map(({ token, row }) => [hashSessionToken(token), row]),
  );
  const lastSeen = new Map<string, Date>();

  return {
    lastSeen,
    async findUserByEmail(email) {
      const wanted = email.toLowerCase();
      return users.find((user) => user.email.toLowerCase() === wanted) ?? null;
    },
    dummyHash: () => DUMMY_HASH,
    async createSession(user: UserRow): Promise<Session> {
      const rawToken =
        crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const tokenHash = hashSessionToken(rawToken);
      const now = options?.clock ? options.clock.now() : new Date();
      const expiresAt = new Date(now.getTime() + (options?.absoluteTtlDays ?? 30) * 86_400_000);
      const sessionId = crypto.randomUUID();

      const principal: Principal = {
        userId: asUserId(user.id),
        tenantId: user.tenantId === null ? null : asTenantId(user.tenantId),
        role: user.role,
        sessionId: asSessionId(sessionId),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        expiresAt,
      };

      const row: SessionRow = {
        id: sessionId,
        principal,
        expiresAt,
        lastSeenAt: now,
      };

      sessions.set(tokenHash, row);

      return {
        token: rawToken,
        expiresAt,
        principal,
      };
    },
    async findSessionByToken(token) {
      return sessions.get(hashSessionToken(token)) ?? null;
    },
    async touchSession(sessionId, at) {
      lastSeen.set(sessionId, at);
    },
    async deleteSession(sessionId) {
      for (const [hash, row] of sessions) {
        if (row.id === sessionId) sessions.delete(hash);
      }
    },
  };
}

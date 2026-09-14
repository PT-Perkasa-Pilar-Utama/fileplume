import { hashSessionToken } from "@archiva/shared";
import type { IdentityRepository, SessionRow, UserRow } from "../repository.ts";

export type SeededSession = { token: string; row: SessionRow };

/**
 * Ships with the module so every module is importable in a test with no
 * network, no container and no environment variables. Sessions are keyed by
 * token hash, as the table is.
 */
export function inMemoryIdentityRepository(
  initial: { users?: UserRow[]; sessions?: SeededSession[] } = {},
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
    dummyHash: () => "$argon2id$v=19$m=65536,t=2,p=1$in-memory$in-memory",
    createSession() {
      throw new Error("SCAFFOLD: in-memory createSession is implemented in BE-S1-02");
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

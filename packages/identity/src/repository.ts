import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { Role } from "@archiva/shared";
import { asSessionId, asTenantId, asUserId, hashSessionToken } from "@archiva/shared";
import { eq } from "drizzle-orm";
import type { Principal } from "./ports.ts";
import type { Session } from "./service.ts";

export type UserRow = {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
};

export type SessionRow = {
  id: string;
  principal: Principal;
  expiresAt: Date;
  lastSeenAt: Date;
};

export interface IdentityRepository {
  findUserByEmail(email: string): Promise<UserRow | null>;
  dummyHash(): string;
  createSession(user: UserRow): Promise<Session>;
  findSessionByToken(token: string): Promise<SessionRow | null>;
  touchSession(sessionId: string, at: Date): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

const { sessions, users } = schema;

function issuedInSessionCard(operation: string): never {
  throw new Error(`SCAFFOLD: identity ${operation} is implemented in BE-S1-02`);
}

/**
 * The read side the request pipeline needs on every call. Issuing and ending
 * a session belong to BE-S1-02 and throw until it lands.
 */
export function createDrizzleIdentityRepository(db: Db): IdentityRepository {
  return {
    findUserByEmail: () => issuedInSessionCard("findUserByEmail"),
    dummyHash: () => issuedInSessionCard("dummyHash"),
    createSession: () => issuedInSessionCard("createSession"),
    deleteSession: () => issuedInSessionCard("deleteSession"),

    async findSessionByToken(token) {
      const [row] = await db
        .select({
          id: sessions.id,
          expiresAt: sessions.expiresAt,
          lastSeenAt: sessions.lastSeenAt,
          userId: users.id,
          tenantId: users.tenantId,
          role: users.role,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, hashSessionToken(token)));
      if (!row) return null;

      return {
        id: row.id,
        expiresAt: row.expiresAt,
        lastSeenAt: row.lastSeenAt,
        principal: {
          userId: asUserId(row.userId),
          tenantId: row.tenantId === null ? null : asTenantId(row.tenantId),
          role: row.role,
          sessionId: asSessionId(row.id),
        },
      };
    },

    async touchSession(sessionId, at) {
      await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, sessionId));
    },
  };
}

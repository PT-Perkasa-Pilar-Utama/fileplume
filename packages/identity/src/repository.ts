import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { Role } from "@archiva/shared";
import { asSessionId, asTenantId, asUserId, hashSessionToken } from "@archiva/shared";
import { eq } from "drizzle-orm";
import type { Clock, Principal } from "./ports.ts";
import type { Session } from "./service.ts";

export type UserRow = {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
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

/**
 * Syntactically valid Argon2id hash used to prevent user enumeration via timing
 * attacks (AC-40.02, technical-specs/07-security.md 7.1).
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQAAAAAAAAAAA$Q29ycmVjdEhhc2hGb3JUaW1pbmdBdHRhY2tzAAAAAA";

export function createDrizzleIdentityRepository(
  db: Db,
  options?: { clock?: Clock; absoluteTtlDays?: number },
): IdentityRepository {
  const clock = options?.clock ?? { now: () => new Date() };
  const absoluteTtlDays = options?.absoluteTtlDays ?? 30;

  return {
    async findUserByEmail(email) {
      const [row] = await db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          email: users.email,
          passwordHash: users.passwordHash,
          name: users.name,
          role: users.role,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      return row ?? null;
    },

    dummyHash: () => DUMMY_HASH,

    async createSession(user) {
      const rawToken =
        crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const tokenHash = hashSessionToken(rawToken);
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + absoluteTtlDays * 86_400_000);

      const [row] = await db
        .insert(sessions)
        .values({
          userId: user.id,
          tokenHash,
          expiresAt,
          lastSeenAt: now,
        })
        .returning({ id: sessions.id });

      if (!row) {
        throw new Error("Failed to insert session");
      }

      const principal: Principal = {
        userId: asUserId(user.id),
        tenantId: user.tenantId === null ? null : asTenantId(user.tenantId),
        role: user.role,
        sessionId: asSessionId(row.id),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        expiresAt,
      };

      return {
        token: rawToken,
        expiresAt,
        principal,
      };
    },

    async findSessionByToken(token) {
      const [row] = await db
        .select({
          id: sessions.id,
          expiresAt: sessions.expiresAt,
          lastSeenAt: sessions.lastSeenAt,
          userId: users.id,
          tenantId: users.tenantId,
          role: users.role,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
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
          name: row.name,
          email: row.email,
          avatarUrl: row.avatarUrl,
          expiresAt: row.expiresAt,
        },
      };
    },

    async touchSession(sessionId, at) {
      await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, sessionId));
    },

    async deleteSession(sessionId) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    },
  };
}

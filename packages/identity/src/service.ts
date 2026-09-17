import type { Result, Role } from "@archiva/shared";
import { err, hasRoleAtLeast, ok } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { Clock, PasswordHasher, Principal } from "./ports.ts";
import type { IdentityRepository } from "./repository.ts";

export type Session = { token: string; expiresAt: Date; principal: Principal };

export interface IdentityService {
  authenticate(
    email: string,
    password: string,
    tenantId: string | null,
  ): Promise<Result<Session, E.InvalidCredentials>>;
  resolveSession(token: string): Promise<Result<Principal, E.SessionExpired | E.SessionRevoked>>;
  endSession(sessionId: string): Promise<void>;
  hasRoleAtLeast(principal: Principal, floor: Role): boolean;
}

export function createIdentityService(deps: {
  repository: IdentityRepository;
  hasher: PasswordHasher;
  clock: Clock;
  idleTtlHours: number;
}): IdentityService {
  const { repository, hasher, clock, idleTtlHours } = deps;

  return {
    async authenticate(email, password, tenantId) {
      const user = await repository.findUserByEmail(email);
      // Verify against a dummy hash when the user is absent, so an unknown
      // email costs the same time as a wrong password. AC-40.02.
      const hash = user?.passwordHash ?? repository.dummyHash();
      const valid = await hasher.verify(password, hash);
      if (!user || !valid || user.tenantId !== tenantId) {
        return err({ kind: "InvalidCredentials" });
      }
      return ok(await repository.createSession(user));
    },

    async resolveSession(token) {
      const session = await repository.findSessionByToken(token);
      if (!session) return err({ kind: "SessionRevoked" });
      const now = clock.now();
      // Evaluated on read, not by a sweeper, so an expired session is never
      // briefly valid. AC-40.04.
      const idleDeadline = new Date(session.lastSeenAt.getTime() + idleTtlHours * 3600000);
      if (now > session.expiresAt || now > idleDeadline) {
        return err({ kind: "SessionExpired" });
      }
      await repository.touchSession(session.id, now);
      return ok(session.principal);
    },

    endSession: (id) => repository.deleteSession(id),
    hasRoleAtLeast: (principal, floor) => hasRoleAtLeast(principal.role, floor),
  };
}

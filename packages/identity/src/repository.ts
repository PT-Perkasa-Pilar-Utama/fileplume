import type { Role } from "@archiva/shared";
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

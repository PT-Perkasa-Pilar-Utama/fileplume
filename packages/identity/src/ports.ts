import type { Role, SessionId, TenantId, UserId } from "@archiva/shared";

export interface PasswordHasher {
  verify(password: string, hash: string): Promise<boolean>;
  hash(password: string): Promise<string>;
}

export interface Clock {
  now(): Date;
}

/** `tenantId` is null only for `super_admin`, which sits outside every tenant. */
export type Principal = {
  userId: UserId;
  tenantId: TenantId | null;
  role: Role;
  sessionId: SessionId;
};

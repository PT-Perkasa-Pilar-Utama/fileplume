import type { Role } from "@archiva/shared";

export interface PasswordHasher {
  verify(password: string, hash: string): Promise<boolean>;
  hash(password: string): Promise<string>;
}

export interface Clock {
  now(): Date;
}

export type Principal = {
  userId: string;
  tenantId: string | null;
  role: Role;
  sessionId: string;
};

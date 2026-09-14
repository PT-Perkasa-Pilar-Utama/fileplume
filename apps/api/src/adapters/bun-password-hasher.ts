import type { PasswordHasher } from "@archiva/identity";

/** technical-specs/07-security.md 7.1: Argon2id through `Bun.password`. */
export const bunPasswordHasher: PasswordHasher = {
  verify: (password, hash) => Bun.password.verify(password, hash),
  hash: (password) => Bun.password.hash(password, "argon2id"),
};

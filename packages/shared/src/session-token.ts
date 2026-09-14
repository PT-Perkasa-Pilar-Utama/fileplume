/**
 * api-specs/02-authentication.md 2.1: the cookie carries the raw token and
 * `sessions.token_hash` holds only its SHA-256, so a leaked table grants no
 * session. Defined once, because the identity repository and the dev seed
 * must hash the same way.
 */
export function hashSessionToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

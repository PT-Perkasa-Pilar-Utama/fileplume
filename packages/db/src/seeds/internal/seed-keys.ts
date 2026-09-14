import { createHash } from "node:crypto";

const NAMESPACE = "archiva.seed";

function sha256Hex(naturalKey: string): string {
  return createHash("sha256").update(`${NAMESPACE}:${naturalKey}`).digest("hex");
}

/**
 * A stable uuid derived from a natural key. `documents` is the one seeded table
 * with no unique constraint to upsert against, so its identity has to come from
 * here for a second run to update the same row rather than insert a new one.
 * technical-specs/06-data-model.md 6.11.
 */
export function seedId(naturalKey: string): string {
  const h = sha256Hex(naturalKey);
  // Version 5 and the RFC 4122 variant, so the value is a well-formed uuid
  // rather than 32 arbitrary hex characters that happen to fit the column.
  const variant = "89ab".charAt(Number.parseInt(h.slice(16, 17), 16) % 4);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * A stable SHA-256 hex digest for a seeded version. Distinct per natural key,
 * so `UNIQUE (tenant_id, content_hash)` holds across the whole seeded set.
 * These describe bytes no blob store holds: seeds write rows only.
 */
export function seedContentHash(naturalKey: string): string {
  return sha256Hex(`content:${naturalKey}`);
}

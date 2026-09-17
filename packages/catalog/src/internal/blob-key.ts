/**
 * Blob keys are generated from uuids, never from a user-supplied filename.
 * technical-specs/07-security.md 7.5.
 */
export function blobKey(tenantId: string, documentId: string, versionId: string): string {
  return `t/${tenantId}/d/${documentId}/v/${versionId}`;
}

/** The S3 adapter refuses a key whose prefix does not match the active tenant. */
export function belongsToTenant(key: string, tenantId: string): boolean {
  return key.startsWith(`t/${tenantId}/`);
}

export class InvalidBlobKeyPrefixError extends Error {
  constructor(key: string, tenantId: string) {
    super(`Blob key "${key}" does not belong to tenant "${tenantId}"`);
    this.name = "InvalidBlobKeyPrefixError";
  }
}

/** Asserts blob key prefix matches active tenant. Refuses cross-tenant keys. technical-specs/07-security.md 7.3 */
export function assertBlobKeyPrefix(key: string, tenantId: string): void {
  if (!belongsToTenant(key, tenantId)) {
    throw new InvalidBlobKeyPrefixError(key, tenantId);
  }
}

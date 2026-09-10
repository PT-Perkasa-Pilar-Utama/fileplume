/**
 * Blob keys are generated from uuids, never from a user-supplied filename.
 * technical-specs/07-security.md 7.5. Internal: no other package can import this.
 */
export function blobKey(tenantId: string, documentId: string, versionId: string): string {
  return `t/${tenantId}/d/${documentId}/v/${versionId}`;
}

/** The S3 adapter refuses a key whose prefix does not match the active tenant. */
export function belongsToTenant(key: string, tenantId: string): boolean {
  return key.startsWith(`t/${tenantId}/`);
}

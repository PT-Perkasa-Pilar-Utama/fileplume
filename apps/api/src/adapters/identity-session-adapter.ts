import type { SessionPort } from "@archiva/catalog";
import type { IdentityService } from "@archiva/identity";

/**
 * Resolves session validity against the live identity service.
 * AC-01.08, api-specs/02-authentication.md 2.5, 05-documents.md 5.2.
 */
export function createIdentitySessionAdapter(identity: IdentityService): SessionPort {
  return {
    async validateSession(token: string): Promise<boolean> {
      const res = await identity.resolveSession(token);
      return res.ok;
    },
  };
}

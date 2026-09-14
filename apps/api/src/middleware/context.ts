import type { Principal } from "@archiva/identity";
import type { Tenant } from "@archiva/tenancy";

/**
 * Step 2 of api-specs/01-conventions.md 1.12, recorded rather than enforced:
 * login is public, so the route's floor decides whether a missing session is
 * a 401.
 */
export type SessionState =
  | { kind: "authenticated"; principal: Principal }
  | { kind: "absent" }
  | { kind: "expired" };

export type AppEnv = {
  Variables: {
    requestId: string;
    /** Null on the reserved `admin` subdomain, which resolves to no tenant. */
    tenant: Tenant | null;
    session: SessionState;
    /** Set by `requireRole` once the floor is cleared. */
    principal: Principal;
  };
};

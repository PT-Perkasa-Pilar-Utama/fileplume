import type { Role } from "@archiva/shared";

export type RequestPrincipal = {
  userId: string;
  tenantId: string | null;
  role: Role;
  sessionId: string;
};

export type AppEnv = {
  Variables: {
    principal: RequestPrincipal;
    tenantId: string;
    requestId: string;
  };
};

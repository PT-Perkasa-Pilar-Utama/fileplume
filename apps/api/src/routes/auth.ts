import { one } from "@archiva/shared";
import { login, logout, me } from "./definitions/auth.ts";
import { MOCK_PRINCIPAL, MOCK_SESSION } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/02-authentication.md. Cards BE-S1-02, FE-S1-05. */
export const authRoutes = createRouter()
  .openapi(login, (c) => c.json(one(MOCK_SESSION), 200))
  .openapi(logout, (c) => c.body(null, 204))
  .openapi(me, (c) => c.json(one(MOCK_PRINCIPAL), 200));

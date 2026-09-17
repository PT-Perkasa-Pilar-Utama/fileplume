import { dataOf, loginBody, principalSchema, sessionSchema } from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import {
  ERROR_401,
  ERROR_404,
  ERROR_422,
  ERROR_429,
  json,
  jsonBody,
  SESSION,
} from "./responses.ts";

const tags = ["Authentication"];

/** api-specs/02-authentication.md 2.2. Public: the only tenant-scoped operation without a session. */
export const login = createRoute({
  method: "post",
  path: "/login",
  tags,
  summary: "Exchange an email and password for a session cookie",
  request: { body: jsonBody(loginBody) },
  responses: {
    200: json(dataOf(sessionSchema), "Session issued; Set-Cookie carries the token"),
    ...ERROR_401,
    ...ERROR_404,
    ...ERROR_422,
    ...ERROR_429,
  },
});

/** 2.3. Idempotent: an already-ended session still answers 204. */
export const logout = createRoute({
  method: "post",
  path: "/logout",
  tags,
  summary: "End the current session",
  security: SESSION,
  responses: { 204: { description: "Session ended; Set-Cookie expires the cookie" }, ...ERROR_401 },
});

/** 2.4. */
export const me = createRoute({
  method: "get",
  path: "/me",
  tags,
  summary: "Resolve the session into the principal and its menus",
  security: SESSION,
  middleware: requireRole("authenticated"),
  responses: { 200: json(dataOf(principalSchema), "The current principal"), ...ERROR_401 },
});

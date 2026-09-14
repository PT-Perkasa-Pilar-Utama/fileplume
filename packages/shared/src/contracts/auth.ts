import { z } from "zod";
import { ROLES } from "../roles.ts";
import { timestampSchema } from "./common.ts";
import { MENUS } from "./enums.ts";

/** api-specs/02-authentication.md 2.2. */
export const loginBody = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof loginBody>;

export const userSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.enum(ROLES),
    avatarUrl: z.string().nullable(),
  })
  .meta({ id: "User" });
export type User = z.infer<typeof userSchema>;

export const tenantRefSchema = z
  .object({ id: z.uuid(), name: z.string(), subdomain: z.string() })
  .meta({ id: "TenantRef" });

/** Null for a super_admin, who belongs to no tenant. */
export const sessionSchema = z
  .object({
    user: userSchema,
    tenant: tenantRefSchema.nullable(),
    expiresAt: timestampSchema,
  })
  .meta({ id: "Session" });
export type Session = z.infer<typeof sessionSchema>;

/** 2.4. `menus` is derived from the role floor and consulted by nothing on the server. */
export const principalSchema = sessionSchema
  .extend({ menus: z.array(z.enum(MENUS)) })
  .meta({ id: "Principal" });
export type PrincipalView = z.infer<typeof principalSchema>;

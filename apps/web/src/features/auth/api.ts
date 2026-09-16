import {
  dataOf,
  type LoginBody,
  type PrincipalView,
  principalSchema,
  sessionSchema,
} from "@archiva/shared";
import { z } from "zod";
import { apiFetch } from "../../lib/api.ts";

export async function fetchCurrentPrincipal(): Promise<PrincipalView> {
  const response = await apiFetch("/auth/me", dataOf(principalSchema));
  return response.data;
}

export async function loginRequest(body: LoginBody): Promise<PrincipalView> {
  await apiFetch("/auth/login", dataOf(sessionSchema), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // After login, fetch /auth/me to receive full PrincipalView with menus
  return fetchCurrentPrincipal();
}

export async function logoutRequest(): Promise<void> {
  await apiFetch("/auth/logout", z.null().optional(), {
    method: "POST",
  });
}

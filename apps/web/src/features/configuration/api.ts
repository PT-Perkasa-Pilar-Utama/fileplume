import {
  type ConfigKeyName,
  type ConfigParameter,
  collectionOf,
  configParameterSchema,
  dataOf,
} from "@archiva/shared";
import { apiFetch } from "../../lib/api.ts";

export async function fetchConfiguration(): Promise<ConfigParameter[]> {
  const response = await apiFetch("/configuration", collectionOf(configParameterSchema));
  return response.data;
}

export async function updateConfigValue(
  key: ConfigKeyName,
  value: number,
): Promise<ConfigParameter> {
  const response = await apiFetch(`/configuration/${key}`, dataOf(configParameterSchema), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  return response.data;
}

export async function resetConfigValue(key: ConfigKeyName): Promise<ConfigParameter> {
  const response = await apiFetch(`/configuration/${key}`, dataOf(configParameterSchema), {
    method: "DELETE",
  });
  return response.data;
}

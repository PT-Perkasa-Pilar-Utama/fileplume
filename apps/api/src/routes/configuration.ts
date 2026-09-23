import { CONFIG_KEY_NAMES, type ConfigKeyName, type ConfigParameter, one } from "@archiva/shared";
import { CONFIG_KEYS } from "@archiva/tenancy";
import {
  listConfiguration,
  resetConfigValue,
  setConfigValue,
} from "./definitions/configuration.ts";
import { createRouter } from "./router.ts";

const LABELS: Record<ConfigKeyName, string> = {
  max_file_size_mb: "Max File Size",
  pending_confirmation_days: "Batas Waktu Konfirmasi Kategori",
  storage_quota_gb: "Kuota Penyimpanan",
};

/** Served, not hardcoded in the client, so the table and the ranges cannot drift. */
function parameter(key: ConfigKeyName): ConfigParameter {
  const spec = CONFIG_KEYS[key];
  return {
    key,
    label: LABELS[key],
    value: spec.default,
    defaultValue: spec.default,
    unit: spec.unit,
    min: spec.min,
    max: spec.max,
    editable: spec.tenantEditable,
    isDefault: true,
    updatedAt: null,
    updatedBy: null,
  };
}

/** api-specs/04-configuration.md. Cards BE-S2-05, FE-S2-05. */
export const configurationRoutes = createRouter()
  .openapi(listConfiguration, (c) => {
    const data = CONFIG_KEY_NAMES.map(parameter);
    return c.json({ data, meta: { total: data.length } }, 200);
  })
  .openapi(setConfigValue, (c) => c.json(one(parameter(c.req.valid("param").key)), 200))
  .openapi(resetConfigValue, (c) => c.json(one(parameter(c.req.valid("param").key)), 200));

import { one } from "@archiva/shared";
import { CONFIG_KEYS } from "@archiva/tenancy";
import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";

const LABELS: Record<keyof typeof CONFIG_KEYS, string> = {
  max_file_size_mb: "Max File Size",
  pending_confirmation_days: "Batas Waktu Konfirmasi Kategori",
  storage_quota_gb: "Kuota Penyimpanan",
};

/** Served, not hardcoded in the client, so the table and the ranges cannot drift. */
const parameters = Object.entries(CONFIG_KEYS).map(([key, spec]) => ({
  key,
  label: LABELS[key as keyof typeof CONFIG_KEYS],
  value: spec.default,
  defaultValue: spec.default,
  unit: spec.unit,
  min: spec.min,
  max: spec.max,
  editable: spec.tenantEditable,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
}));

/** api-specs/04-configuration.md. Cards BE-S2-05, FE-S2-05. */
export const configurationRoutes = new Hono<AppEnv>()
  // 4.2
  .get("/", requireRole("admin_tenant"), (c) =>
    c.json({ data: parameters, meta: { total: parameters.length } }),
  )
  // 4.3
  .patch("/:key", requireRole("admin_tenant"), (c) => c.json(one(parameters[0])))
  // 4.4
  .delete("/:key", requireRole("admin_tenant"), (c) => c.json(one(parameters[0])));

/** api-specs/04-configuration.md 4.5. Card BE-S2-02. */
export const storageRoutes = new Hono<AppEnv>().get("/", requireRole("member"), (c) =>
  c.json(
    one({
      usedBytes: 13421772800,
      quotaBytes: 53687091200,
      percent: 25,
      level: "ok" as const,
      message: null,
    }),
  ),
);

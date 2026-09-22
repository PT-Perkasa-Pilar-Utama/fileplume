import type { ConfigKeyName, ConfigParameter } from "@archiva/shared";

export type ConfigKeySpec = {
  default: number;
  min: number;
  max: number;
  unit: string;
  tenantEditable: boolean;
};

/** technical-specs/06-data-model.md 6.3. Keyed by the shared closed union, so a missing key fails to compile. */
export const CONFIG_KEYS = {
  max_file_size_mb: { default: 20, min: 1, max: 200, unit: "MB", tenantEditable: true },
  pending_confirmation_days: { default: 7, min: 1, max: 90, unit: "hari", tenantEditable: true },
  storage_quota_gb: { default: 50, min: 1, max: 10000, unit: "GB", tenantEditable: false },
} as const satisfies Record<ConfigKeyName, ConfigKeySpec>;

export const BYTES_PER_GB = 1024 ** 3;

/** Derived from the closed key set above, so the fallback and the default cannot drift apart. */
export const DEFAULT_STORAGE_QUOTA_BYTES = CONFIG_KEYS.storage_quota_gb.default * BYTES_PER_GB;

export const CONFIG_KEY_LABELS: Record<ConfigKey, string> = {
  max_file_size_mb: "Max File Size",
  pending_confirmation_days: "Batas Waktu Konfirmasi Kategori",
  storage_quota_gb: "Kuota Penyimpanan",
};

export type ConfigKey = keyof typeof CONFIG_KEYS;

export type StoredConfigRow = {
  key: ConfigKey;
  value: number;
  updatedAt: Date;
  updatedBy: { id: string; name: string } | null;
};

export function buildConfigParameters(
  entries: StoredConfigRow[],
  usageQuotaBytes: number,
): ConfigParameter[] {
  const entryMap = new Map(entries.map((e) => [e.key, e]));

  return (Object.keys(CONFIG_KEYS) as ConfigKey[]).map((key) => {
    const spec = CONFIG_KEYS[key];
    const label = CONFIG_KEY_LABELS[key];

    if (key === "storage_quota_gb") {
      const quotaGb = Math.floor(usageQuotaBytes / BYTES_PER_GB);
      return {
        key,
        label,
        value: quotaGb,
        defaultValue: spec.default,
        unit: spec.unit,
        min: spec.min,
        max: spec.max,
        editable: false,
        isDefault: quotaGb === spec.default,
        updatedAt: null,
        updatedBy: null,
      };
    }

    const entry = entryMap.get(key);
    if (entry) {
      return {
        key,
        label,
        value: entry.value,
        defaultValue: spec.default,
        unit: spec.unit,
        min: spec.min,
        max: spec.max,
        editable: spec.tenantEditable,
        isDefault: false,
        updatedAt: entry.updatedAt.toISOString(),
        updatedBy: entry.updatedBy,
      };
    }

    return {
      key,
      label,
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
  });
}

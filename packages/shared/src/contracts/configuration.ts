import { z } from "zod";
import { personRefSchema, timestampSchema } from "./common.ts";
import { CONFIG_KEY_NAMES, STORAGE_LEVELS } from "./enums.ts";

/** api-specs/04-configuration.md 4.3. An unknown key is VALIDATION_ERROR, not 404. */
export const configKeyParams = z.object({ key: z.enum(CONFIG_KEY_NAMES) });

/**
 * 4.3 step 3. The value is typed by the service, not here: a non-integer must
 * answer INVALID_CONFIG_VALUE with the AC-42.03 message, and a schema refusal
 * would answer VALIDATION_ERROR instead. Only a missing value is a shape error.
 */
export const setConfigValueBody = z.object({
  value: z.union([z.number(), z.string()]).meta({
    description: "An integer within the key's range. A numeric string is refused, not coerced.",
  }),
});
export type SetConfigValueBody = z.infer<typeof setConfigValueBody>;

/** 4.2. `label` and `unit` are served so the table and the ranges cannot drift. */
export const configParameterSchema = z
  .object({
    key: z.enum(CONFIG_KEY_NAMES),
    label: z.string(),
    value: z.number().int(),
    defaultValue: z.number().int(),
    unit: z.string(),
    min: z.number().int(),
    max: z.number().int(),
    editable: z.boolean(),
    isDefault: z.boolean(),
    updatedAt: timestampSchema.nullable(),
    updatedBy: personRefSchema.nullable(),
  })
  .meta({ id: "ConfigParameter" });
export type ConfigParameter = z.infer<typeof configParameterSchema>;

/** 4.5. `percent` is rounded down and not clamped, so it may exceed 100. */
export const storageSchema = z
  .object({
    usedBytes: z.number().int().nonnegative(),
    quotaBytes: z.number().int().nonnegative(),
    percent: z.number().int().nonnegative(),
    level: z.enum(STORAGE_LEVELS),
    message: z.string().nullable(),
  })
  .meta({ id: "Storage" });
export type StorageView = z.infer<typeof storageSchema>;

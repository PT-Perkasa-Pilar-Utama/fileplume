import { AppError, formatErrorMessage, one } from "@archiva/shared";
import { CONFIG_KEYS, type TenancyService } from "@archiva/tenancy";
import {
  listConfiguration,
  resetConfigValue,
  setConfigValue,
} from "./definitions/configuration.ts";
import { createRouter } from "./router.ts";

/** api-specs/04-configuration.md. Cards BE-S2-05, FE-S2-05. */
export function createConfigurationRoutes(
  tenancy: Pick<TenancyService, "getConfiguration" | "setConfigValue" | "resetConfigValue">,
) {
  return createRouter()
    .openapi(listConfiguration, async (c) => {
      const principal = c.get("principal");
      if (!principal.tenantId) throw new AppError("NOT_FOUND");
      const data = await tenancy.getConfiguration(principal.tenantId);
      return c.json({ data, meta: { total: data.length } }, 200);
    })
    .openapi(setConfigValue, async (c) => {
      const principal = c.get("principal");
      if (!principal.tenantId) throw new AppError("NOT_FOUND");
      const param = c.req.valid("param");
      const body = c.req.valid("json");

      const result = await tenancy.setConfigValue(
        principal.tenantId,
        param.key,
        body.value,
        principal.userId,
      );

      if (!result.ok) {
        if (result.error.kind === "NotEditableByTenant") {
          throw new AppError("NOT_EDITABLE_BY_TENANT");
        }
        if (result.error.kind === "InvalidConfigValue") {
          throw new AppError("INVALID_CONFIG_VALUE");
        }
        if (result.error.kind === "ValueOutOfRange") {
          const spec = CONFIG_KEYS[param.key];
          throw new AppError(
            "VALUE_OUT_OF_RANGE",
            undefined,
            formatErrorMessage("VALUE_OUT_OF_RANGE", {
              min: spec.min,
              max: spec.max,
              unit: spec.unit,
            }),
          );
        }
        throw new AppError("INTERNAL_ERROR");
      }

      await c.get("activity").record({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: "config.change",
        subjectType: "configuration",
        subjectId: param.key,
        outcome: "allowed",
        metadata: {
          key: param.key,
          previousValue: result.value.previousValue,
          value: result.value.parameter.value,
        },
      });

      return c.json(one(result.value.parameter), 200);
    })
    .openapi(resetConfigValue, async (c) => {
      const principal = c.get("principal");
      if (!principal.tenantId) throw new AppError("NOT_FOUND");
      const param = c.req.valid("param");

      const result = await tenancy.resetConfigValue(
        principal.tenantId,
        param.key,
        principal.userId,
      );

      if (!result.ok) {
        if (result.error.kind === "NotEditableByTenant") {
          throw new AppError("NOT_EDITABLE_BY_TENANT");
        }
        throw new AppError("INTERNAL_ERROR");
      }

      await c.get("activity").record({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: "config.change",
        subjectType: "configuration",
        subjectId: param.key,
        outcome: "allowed",
        metadata: {
          key: param.key,
          value: result.value.value,
          reset: true,
        },
      });

      return c.json(one(result.value), 200);
    });
}

import { describe, expect, test } from "bun:test";
import type { ConfigParameter } from "@archiva/shared";
import { buildTestApp, errorOf, TENANT_A, TOKENS, tenantRequest } from "../testing/test-app.ts";

describe("PATCH /configuration/:key", () => {
  // AC-42.02: Mengubah nilai parameter
  test("admin_tenant updates parameter value and records config.change audit event", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 50 }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ConfigParameter };
    expect(body.data.key).toBe("max_file_size_mb");
    expect(body.data.value).toBe(50);
    expect(body.data.defaultValue).toBe(20);
    expect(body.data.isDefault).toBe(false);
    expect(body.data.updatedAt).not.toBeNull();
    expect(body.data.updatedBy).not.toBeNull();

    // Verify subsequent GET reflects updated value
    const getRes = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.adminA,
      }),
    );
    const getBody = (await getRes.json()) as { data: ConfigParameter[] };
    const maxParam = getBody.data.find((p) => p.key === "max_file_size_mb");
    expect(maxParam?.value).toBe(50);
    expect(maxParam?.isDefault).toBe(false);

    // Verify audit event
    const auditEvent = app.activityRepository.events.find(
      (e) => e.action === "config.change" && e.subjectId === "max_file_size_mb",
    );
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.tenantId).toBe(TENANT_A.id);
    expect(auditEvent?.outcome).toBe("allowed");
    expect(auditEvent?.metadata).toEqual({
      key: "max_file_size_mb",
      previousValue: 20,
      value: 50,
    });
  });

  // AC-42.03: Menolak nilai non-angka (Negative Path)
  test("rejects non-numeric string with exact Indonesian error and leaves value unchanged", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "dua puluh" }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "INVALID_CONFIG_VALUE",
      message: "Nilai harus berupa angka",
    });

    // Check value did not change
    const getRes = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.adminA,
      }),
    );
    const getBody = (await getRes.json()) as { data: ConfigParameter[] };
    const maxParam = getBody.data.find((p) => p.key === "max_file_size_mb");
    expect(maxParam?.value).toBe(20);
  });

  // AC-42.03: No coercion: numeric string "20" is rejected
  test("rejects numeric string '20' without coercion", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "20" }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "INVALID_CONFIG_VALUE",
      message: "Nilai harus berupa angka",
    });
  });

  // AC-42.03: Decimal non-integer is rejected
  test("rejects decimal value with INVALID_CONFIG_VALUE", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 20.5 }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "INVALID_CONFIG_VALUE",
      message: "Nilai harus berupa angka",
    });
  });

  // AC-42.04: Menolak nilai di luar rentang (Negative Path)
  test("rejects value above maximum with VALUE_OUT_OF_RANGE and interpolated message", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 500 }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "VALUE_OUT_OF_RANGE",
      message: "Nilai harus antara 1 dan 200 MB",
    });

    // Check value did not change
    const getRes = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.adminA,
      }),
    );
    const getBody = (await getRes.json()) as { data: ConfigParameter[] };
    const maxParam = getBody.data.find((p) => p.key === "max_file_size_mb");
    expect(maxParam?.value).toBe(20);
  });

  test("rejects value below minimum with VALUE_OUT_OF_RANGE", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 0 }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "VALUE_OUT_OF_RANGE",
      message: "Nilai harus antara 1 dan 200 MB",
    });
  });

  test("rejects out of range for pending_confirmation_days with 'hari' unit", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/pending_confirmation_days", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 100 }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "VALUE_OUT_OF_RANGE",
      message: "Nilai harus antara 1 dan 90 hari",
    });
  });
});

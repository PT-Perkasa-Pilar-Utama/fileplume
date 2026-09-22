import { describe, expect, test } from "bun:test";
import type { ConfigParameter } from "@archiva/shared";
import { buildTestApp, TOKENS, tenantRequest } from "../testing/test-app.ts";

describe("DELETE /configuration/:key", () => {
  // AC-42.05: Mengembalikan parameter ke nilai default
  test("resets modified parameter back to default and records config.change audit event", async () => {
    const app = buildTestApp();

    // Set to 50 first
    await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 50 }),
      }),
    );

    // Reset to default
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "DELETE",
        token: TOKENS.adminA,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ConfigParameter };
    expect(body.data.key).toBe("max_file_size_mb");
    expect(body.data.value).toBe(20);
    expect(body.data.defaultValue).toBe(20);
    expect(body.data.isDefault).toBe(true);
    expect(body.data.updatedAt).toBeNull();
    expect(body.data.updatedBy).toBeNull();

    // Verify subsequent GET returns default
    const getRes = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.adminA,
      }),
    );
    const getBody = (await getRes.json()) as { data: ConfigParameter[] };
    const maxParam = getBody.data.find((p) => p.key === "max_file_size_mb");
    expect(maxParam?.value).toBe(20);
    expect(maxParam?.isDefault).toBe(true);

    // Verify reset audit event
    const resetEvent = app.activityRepository.events.find(
      (e) => e.action === "config.change" && e.metadata?.reset === true,
    );
    expect(resetEvent).toBeDefined();
    expect(resetEvent?.metadata).toEqual({
      key: "max_file_size_mb",
      value: 20,
      reset: true,
    });
  });

  // Idempotent: resetting an already-default key succeeds
  test("resetting an unset parameter is idempotent and returns 200 with default", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        method: "DELETE",
        token: TOKENS.adminA,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ConfigParameter };
    expect(body.data.value).toBe(20);
    expect(body.data.isDefault).toBe(true);
  });
});

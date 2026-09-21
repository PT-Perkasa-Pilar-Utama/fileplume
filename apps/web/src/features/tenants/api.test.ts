import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ERROR_MESSAGES, type TenantListItem, type TenantView } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import { createTenantRequest, fetchTenants } from "./api.ts";

const MOCK_TENANT: TenantView = {
  id: "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
  name: "PT Contoh Baru",
  subdomain: "contohbaru",
  status: "active",
  storageQuotaBytes: 53687091200,
  storageUsedBytes: 0,
  createdAt: "2026-09-10T02:11:44.000Z",
};

const MOCK_TENANT_LIST_ITEM: TenantListItem = {
  ...MOCK_TENANT,
  storagePercent: 0,
  documentCount: 0,
  userCount: 1,
};

describe("tenants api client", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-43.01: GET /api/v1/tenants
  test("fetchTenants requests /api/v1/tenants with query params and parses response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [MOCK_TENANT_LIST_ITEM],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchTenants({ page: 1, limit: 10, q: "contoh" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]?.[0];
    expect(calledUrl).toBe("/api/v1/tenants?page=1&limit=10&q=contoh");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.name).toBe("PT Contoh Baru");
    expect(result.meta.total).toBe(1);
  });

  // AC-43.01: POST /api/v1/tenants success
  test("createTenantRequest posts valid body and returns created tenant view", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_TENANT }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createTenantRequest({
      name: "PT Contoh Baru",
      subdomain: "contohbaru",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe("/api/v1/tenants");
    expect(calledInit?.method).toBe("POST");
    expect(JSON.parse(calledInit?.body as string)).toEqual({
      name: "PT Contoh Baru",
      subdomain: "contohbaru",
    });
    expect(result.id).toBe(MOCK_TENANT.id);
    expect(result.status).toBe("active");
  });

  // AC-43.01: Conflict 409 TENANT_NAME_TAKEN
  test("createTenantRequest throws ApiError when tenant name is taken", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "TENANT_NAME_TAKEN",
            message: ERROR_MESSAGES.TENANT_NAME_TAKEN,
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await createTenantRequest({
        name: "PT Contoh Baru",
        subdomain: "contohbaru",
      });
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(409);
        expect(err.code).toBe("TENANT_NAME_TAKEN");
        expect(err.message).toBe("Nama organisasi sudah digunakan");
      }
    }
  });

  // AC-43.01: Conflict 409 SUBDOMAIN_TAKEN
  test("createTenantRequest throws ApiError when subdomain is taken", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "SUBDOMAIN_TAKEN",
            message: ERROR_MESSAGES.SUBDOMAIN_TAKEN,
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await createTenantRequest({
        name: "PT Contoh Baru",
        subdomain: "contohbaru",
      });
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(409);
        expect(err.code).toBe("SUBDOMAIN_TAKEN");
        expect(err.message).toBe("Subdomain sudah digunakan");
      }
    }
  });
});

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

/**
 * FE-S2-07: Wire upload end to end against the running stack (Issue #39).
 * Proves the full upload tray seam and acceptance criteria against the running server:
 * AC-01.01, AC-01.06, AC-01.07, AC-01.08, AC-03.01, AC-03.04, AC-35.03, AC-35.04.
 * Refs: api-specs/05-documents.md 5.2; api-specs/01-conventions.md 1.6.
 */

const TENANT_A = "http://archiva-demo.localhost:4173";
const TENANT_B = "http://mitra-rahasia.localhost:4173";
const MEMBER_SESSION = "__Host-archiva_session=dev-session-member";
const DEFAULT_QUOTA = 53687091200;
const PSQL_ARGS = "compose exec -T postgres psql -U archiva -d archiva -t -A -c".split(" ");

function queryPsql(sql: string): string {
  return execFileSync("docker", [...PSQL_ARGS, sql], { encoding: "utf-8" }).trim();
}

const setQuota = (bytes: number | string) =>
  queryPsql(`UPDATE tenants SET storage_quota_bytes = ${bytes} WHERE subdomain = 'archiva-demo';`);

function cleanupTestDocs(): void {
  const titles =
    "'presentasi-baru.pdf','laporan-keuangan.pdf','laporan-keuangan-salinan.pdf','kontrak-1.pdf','kontrak-2.pdf','kontrak-kerjasama.pdf','batch-file-1.txt','batch-file-2.txt','batch-file-3.txt','penuh-test.txt','fixture-reporting-01.pdf'";
  queryPsql(`DO $$ BEGIN
    UPDATE documents SET current_version_id = NULL WHERE created_at > now() - interval '2 hours' AND title IN (${titles});
    DELETE FROM document_versions WHERE document_id NOT IN (SELECT id FROM documents WHERE current_version_id IS NOT NULL);
    DELETE FROM documents WHERE current_version_id IS NULL;
  END $$;`);
}

function postDoc(req: APIRequestContext, origin: string, name: string, buffer: Buffer) {
  return req.post(`${origin}/api/v1/documents`, {
    headers: { cookie: MEMBER_SESSION, origin },
    multipart: { files: { name, mimeType: "application/pdf", buffer } },
  });
}

const inputOf = (page: Page) => page.getByTestId("upload-file-input");

async function authMember(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.setCookie", {
    name: "__Host-archiva_session",
    value: "dev-session-member",
    url: `${TENANT_A}/`,
    path: "/",
    secure: true,
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

test.describe("Upload end to end (FE-S2-07)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => cleanupTestDocs());
  test.afterAll(() => {
    setQuota(DEFAULT_QUOTA);
    cleanupTestDocs();
  });

  // AC-01.01: Mengunggah satu file PDF yang valid
  test("AC-01.01: single valid PDF upload displays success message and appears in list", async ({
    page,
  }) => {
    await authMember(page);
    await inputOf(page).setInputFiles(path.resolve("fixtures/presentasi-baru.pdf"));

    await expect(page.getByTestId("upload-success-alert")).toBeVisible();
    await expect(page.getByText("File diterima untuk diproses").first()).toBeVisible();
    await expect(page.getByText("presentasi-baru.pdf").first()).toBeVisible();
  });

  // AC-01.06: Melebihi batas ukuran file (Negative Path)
  test("AC-01.06: 25 MB file refused with exact message and endpoint returns 422", async ({
    page,
    request,
  }) => {
    await authMember(page);
    const oversizePath = path.resolve("fixtures/generated/berkas-25mb.pdf");
    await inputOf(page).setInputFiles(oversizePath);

    await expect(page.getByText("Ukuran file melebihi batas 20 MB")).toBeVisible();

    const res = await postDoc(request, TENANT_A, "berkas-25mb.pdf", fs.readFileSync(oversizePath));
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.data.results[0].error.code).toBe("FILE_TOO_LARGE");
    expect(body.data.results[0].error.message).toBe("Ukuran file melebihi batas 20 MB");
  });

  // AC-01.07: Unggahan terputus di tengah proses (Negative Path)
  test("AC-01.07: interrupted upload shows verbatim error and stores nothing", async ({ page }) => {
    await authMember(page);
    await page.route("**/api/v1/documents", (route) => route.abort("failed"));
    await inputOf(page).setInputFiles(path.resolve("fixtures/fixture-reporting-01.pdf"));

    await expect(page.getByText("Unggahan terputus. Silakan coba lagi").first()).toBeVisible();
    await page.unroute("**/api/v1/documents");

    const count = queryPsql(
      "SELECT count(*) FROM documents WHERE title = 'fixture-reporting-01.pdf';",
    );
    expect(Number(count)).toBe(0);
  });

  // AC-01.08: Sesi berakhir saat unggahan berlangsung (Negative Path)
  test("AC-01.08: expired session displays exact error notice and endpoint returns 401", async ({
    page,
    request,
  }) => {
    await authMember(page);
    await page.route("**/api/v1/documents", (route) =>
      route.fulfill({
        status: 401,
        json: {
          error: {
            code: "SESSION_EXPIRED",
            message: "Sesi Anda telah berakhir. Silakan login kembali",
          },
        },
      }),
    );
    await inputOf(page).setInputFiles(path.resolve("fixtures/kontrak-kerjasama.pdf"));

    await expect(
      page.getByText("Sesi Anda telah berakhir. Silakan login kembali").first(),
    ).toBeVisible();
    await page.unroute("**/api/v1/documents");

    const res = await request.post(`${TENANT_A}/api/v1/documents`, {
      headers: { cookie: "__Host-archiva_session=invalid-token", origin: TENANT_A },
      multipart: {
        files: { name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("test") },
      },
    });
    expect(res.status()).toBe(401);
  });

  // AC-03.01: Mencoba mengunggah file duplikat (Negative Path)
  test("AC-03.01: duplicate content shows error with working link to existing document", async ({
    page,
  }) => {
    await authMember(page);
    await inputOf(page).setInputFiles(path.resolve("fixtures/laporan-keuangan.pdf"));
    await expect(page.getByTestId("upload-success-alert")).toBeVisible();

    await inputOf(page).setInputFiles(path.resolve("fixtures/laporan-keuangan-salinan.pdf"));
    await expect(page.getByText("File ini sudah ada di sistem")).toBeVisible();

    const viewLink = page.getByRole("link", { name: "Lihat dokumen" });
    await expect(viewLink).toBeVisible();
    await viewLink.click();

    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+/);
    await expect(page.getByTestId("document-detail-shell")).toBeVisible();
  });

  // AC-03.04: Dua pengguna mengunggah konten identik secara bersamaan
  test("AC-03.04: concurrent identical uploads race: exactly one 201, one 422 refusal", async ({
    request,
  }) => {
    const fileBytes = fs.readFileSync(path.resolve("fixtures/kontrak-kerjasama.pdf"));
    const [res1, res2] = await Promise.all([
      postDoc(request, TENANT_A, "kontrak-1.pdf", fileBytes),
      postDoc(request, TENANT_A, "kontrak-2.pdf", fileBytes),
    ]);
    expect([res1.status(), res2.status()].sort()).toEqual([201, 422]);

    const rejected = res1.status() === 422 ? res1 : res2;
    const body = await rejected.json();
    expect(body.data.results[0].error.code).toBe("DUPLICATE_CONTENT");
    expect(body.data.results[0].error.message).toBe("File ini sudah ada di sistem");
  });

  // AC-35.03: Upload ditolak saat kapasitas penuh (Negative Path)
  test("AC-35.03: upload is refused when storage quota is 100% full", async ({ page }) => {
    setQuota("storage_used_bytes");

    try {
      await authMember(page);
      await inputOf(page).setInputFiles({
        name: "penuh-test.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Dokumen kapasitas penuh"),
      });

      await expect(page.getByText("Kapasitas penyimpanan penuh").first()).toBeVisible();
    } finally {
      setQuota(DEFAULT_QUOTA);
    }
  });

  // AC-35.04: Kuota habis di tengah unggahan beberapa file (Negative Path)
  test("AC-35.04: partial batch displays per-file outcomes and summary banner", async ({
    page,
  }) => {
    const used = Number(
      queryPsql("SELECT storage_used_bytes FROM tenants WHERE subdomain = 'archiva-demo';"),
    );
    setQuota(used + 2048 + 100);

    try {
      await authMember(page);
      await inputOf(page).setInputFiles([
        { name: "batch-file-1.txt", mimeType: "text/plain", buffer: Buffer.from("a".repeat(1024)) },
        { name: "batch-file-2.txt", mimeType: "text/plain", buffer: Buffer.from("b".repeat(1024)) },
        { name: "batch-file-3.txt", mimeType: "text/plain", buffer: Buffer.from("c".repeat(1024)) },
      ]);

      await expect(page.getByTestId("batch-summary-alert")).toBeVisible();
      await expect(page.getByText("2 dari 3 file berhasil diunggah")).toBeVisible();
      await expect(page.getByText("Kapasitas penyimpanan penuh").first()).toBeVisible();
    } finally {
      setQuota(DEFAULT_QUOTA);
    }
  });

  // Definition of done: cross-tenant 404 test
  test("cross-tenant upload is refused with 404", async ({ request }) => {
    const res = await postDoc(
      request,
      TENANT_B,
      "cross-tenant.txt",
      Buffer.from("cross tenant payload"),
    );
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Data tidak ditemukan" },
    });
  });

  // Definition of done: audit row exists for document.upload
  test("audit event exists for document upload action", () => {
    const count = Number(
      queryPsql(
        "SELECT count(*) FROM audit_events WHERE action = 'document.upload' AND outcome = 'allowed' AND subject_type = 'document';",
      ),
    );
    expect(count).toBeGreaterThan(0);
  });
});

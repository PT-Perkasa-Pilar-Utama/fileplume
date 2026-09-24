import { describe, expect, test } from "bun:test";
import { inMemoryBlobStore } from "@archiva/catalog";
import type { UploadBatch } from "@archiva/shared";
import type { TestApp } from "../testing/test-app.ts";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";
import { pdfFile } from "./internal/upload-fixtures.ts";

describe("POST /documents upload races and concurrency (BE-S2-03)", () => {
  test("AC-03.04: two simultaneous identical uploads race: one accepted, one rejected with existingDocumentId", async () => {
    // 06-data-model.md 6.6: UNIQUE (tenant_id, content_hash) decides duplicates
    // on insert, so two simultaneous identical uploads yield one document and one typed refusal.
    const app = buildTestApp();

    const fd1 = new FormData();
    fd1.append("files", pdfFile("kontrak-a.pdf", "kontrak bersamaan 2026"));

    const fd2 = new FormData();
    fd2.append("files", pdfFile("kontrak-b.pdf", "kontrak bersamaan 2026"));

    const [res1, res2] = await Promise.all([
      app.request(
        tenantRequest("/documents", {
          method: "POST",
          token: TOKENS.memberA,
          body: fd1,
        }),
      ),
      app.request(
        tenantRequest("/documents", {
          method: "POST",
          token: TOKENS.memberA,
          body: fd2,
        }),
      ),
    ]);

    const responses = [res1, res2];
    const acceptedRes = responses.find((r) => r.status === 201);
    const rejectedRes = responses.find((r) => r.status === 422);

    expect(acceptedRes).toBeDefined();
    expect(rejectedRes).toBeDefined();
    if (!acceptedRes || !rejectedRes) return;

    const acceptedBody = (await acceptedRes.json()) as { data: UploadBatch };
    const rejectedBody = (await rejectedRes.json()) as { data: UploadBatch };

    expect(acceptedBody.data.accepted).toBe(1);
    expect(acceptedBody.data.rejected).toBe(0);
    const winnerDoc = acceptedBody.data.results[0];
    expect(winnerDoc?.status).toBe("accepted");
    if (winnerDoc?.status !== "accepted") return;

    expect(rejectedBody.data.accepted).toBe(0);
    expect(rejectedBody.data.rejected).toBe(1);
    const loserOutcome = rejectedBody.data.results[0];
    expect(loserOutcome?.status).toBe("rejected");
    if (loserOutcome?.status === "rejected") {
      expect(loserOutcome.error.code).toBe("DUPLICATE_CONTENT");
      expect(loserOutcome.error.message).toBe("File ini sudah ada di sistem");
      expect(loserOutcome.error.existingDocumentId).toBe(winnerDoc.document.id);
    }

    // Only one document exists in the system
    expect(app.catalogRepository.documents).toHaveLength(1);
  });

  test("AC-01.08: session expired mid-upload before commit returns 401 SESSION_EXPIRED and stores nothing", async () => {
    // api-specs/02-authentication.md 2.5, 05-documents.md 5.2:
    // Session resolved before the first byte and again before commit, so an
    // expiring session leaves nothing behind.
    const realBlobStore = inMemoryBlobStore();
    let app: TestApp;

    const expiringBlobStore = {
      keys: () => realBlobStore.keys(),
      async put(key: string, stream: ReadableStream) {
        const outcome = await realBlobStore.put(key, stream);
        // Invalidate session mid-stream while bytes are being written, before commit
        const session = await app.identityRepository.findSessionByToken(TOKENS.memberA);
        if (session) {
          await app.identityRepository.deleteSession(session.id);
        }
        return outcome;
      },
      get: (k: string) => realBlobStore.get(k),
      delete: (k: string) => realBlobStore.delete(k),
    };

    app = buildTestApp(undefined, { blobStore: expiringBlobStore });

    const formData = new FormData();
    formData.append("files", pdfFile("laporan-terputus.pdf", "session expiring content"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(401);
    const err = await errorOf(res);
    expect(err.code).toBe("SESSION_EXPIRED");
    expect(err.message).toBe("Sesi Anda telah berakhir. Silakan login kembali");

    // No partial documents or orphaned blobs remain
    expect(app.catalogRepository.documents).toHaveLength(0);
    expect(app.blobStore.keys()).toHaveLength(0);
  });

  test("cross-tenant isolation: identical content in tenant A and tenant B both succeed", async () => {
    // 06-data-model.md 6.5: UNIQUE (tenant_id, content_hash) is per tenant.
    const app = buildTestApp();

    const fdA = new FormData();
    fdA.append("files", pdfFile("dokumen-a.pdf", "konten sama lintas tenant"));
    const resA = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fdA,
      }),
    );
    expect(resA.status).toBe(201);

    const fdB = new FormData();
    fdB.append("files", pdfFile("dokumen-b.pdf", "konten sama lintas tenant"));
    const resB = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        subdomain: "mitra-rahasia",
        token: TOKENS.memberB,
        body: fdB,
      }),
    );
    expect(resB.status).toBe(201);

    expect(app.catalogRepository.documents).toHaveLength(2);
  });
});

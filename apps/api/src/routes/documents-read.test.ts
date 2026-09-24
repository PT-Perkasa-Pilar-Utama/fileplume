import { describe, expect, test } from "bun:test";
import {
  inMemoryCatalogRepository,
  type StoredDocument,
  type StoredVersion,
} from "@archiva/catalog";
import type { DocumentDetailView, DocumentView, Meta } from "@archiva/shared";
import { asDocumentId, asUserId, asVersionId } from "@archiva/shared";
import { buildTestApp, errorOf, TENANT_A, TOKENS, tenantRequest } from "../testing/test-app.ts";

describe("GET /documents (BE-S2-06)", () => {
  // AC-38.01: Melihat dokumen terbaru sebagai kartu visual
  test("AC-38.01: GET /documents returns visual card fields and Indonesian processing label", async () => {
    const docId = asDocumentId("0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01");
    const verId = asVersionId("0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e02");

    const doc: StoredDocument = {
      id: docId,
      tenantId: TENANT_A.id,
      title: "kontrak-kerjasama.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: verId,
      uploaderId: asUserId("22222222-2222-4222-8222-222222222222"),
      uploaderName: "Budi Santoso",
      createdAt: new Date("2026-09-10T05:20:44.000Z"),
      categoryId: "00000000-0000-4000-8000-000000000010",
      categoryName: "Legal",
      categoryIsSystem: false,
      categoryConfirmedAt: new Date("2026-09-10T05:20:44.000Z"),
      categoryDownloadActive: true,
      documentType: "Perjanjian Kerjasama",
      tags: ["legal", "kontrak"],
      author: "Legal Team",
      documentCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const ver: StoredVersion = {
      id: verId,
      tenantId: TENANT_A.id,
      documentId: docId,
      versionNumber: 1,
      contentHash: "hash-a",
      blobKey: `t/${TENANT_A.id}/d/${docId}/v/${verId}`,
      filename: "kontrak-kerjasama.pdf",
      mimeType: "application/pdf",
      sizeBytes: 245760,
      pageCount: 3,
      uploadedById: doc.uploaderId,
      uploadedByName: doc.uploaderName,
      createdAt: doc.createdAt,
    };

    const repo = inMemoryCatalogRepository({
      documents: [doc],
      versions: [ver],
      seedFixtures: false,
    });
    const app = buildTestApp(undefined, { catalogRepository: repo });

    const res = await app.request(tenantRequest("/documents", { token: TOKENS.memberA }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: DocumentView[]; meta: Meta };
    expect(body.data).toHaveLength(1);

    const card = body.data[0];
    expect(card).toBeDefined();
    if (!card) return;

    expect(card.id).toBe(docId);
    expect(card.fileType).toBe("pdf");
    expect(card.title).toBe("kontrak-kerjasama.pdf");
    expect(card.createdAt).toBe("2026-09-10T05:20:44.000Z");
    expect(card.uploader.name).toBe("Budi Santoso");
    expect(card.processingState).toBe("ready");
    expect(card.processingLabel).toBe("Siap");
  });

  // AC-38.03: Dasbor tanpa dokumen
  test("AC-38.03: empty tenant returns 200 with verbatim empty state message", async () => {
    const repo = inMemoryCatalogRepository({ seedFixtures: false });
    const app = buildTestApp(undefined, { catalogRepository: repo });

    const res = await app.request(tenantRequest("/documents", { token: TOKENS.memberA }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: DocumentView[]; meta: Meta };
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
    expect(body.meta.message).toBe("Belum ada dokumen. Seret file ke area unggah untuk memulai");
  });

  // AC-34.03: Empty category filter message
  test("AC-34.03: category filter matching nothing returns exact category message", async () => {
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest("/documents?categoryId=00000000-0000-4000-8000-000000000999", {
        token: TOKENS.memberA,
      }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: DocumentView[]; meta: Meta };
    expect(body.data).toHaveLength(0);
    expect(body.meta.message).toBe("Tidak ada dokumen pada kategori ini");
  });

  // AC-05.04: Empty tag filter message
  test("AC-05.04: tag filter matching nothing returns exact tag message", async () => {
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest("/documents?tags=nonexistent", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: DocumentView[]; meta: Meta };
    expect(body.data).toHaveLength(0);
    expect(body.meta.message).toBe("Tidak ada dokumen dengan kombinasi tag ini");
  });

  test("pagination contract: limits rows and calculates totalPages", async () => {
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest("/documents?page=1&limit=1", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: DocumentView[]; meta: Meta };
    expect(body.data).toHaveLength(1);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.totalPages).toBe(1);
  });
});

describe("GET /documents/:id (BE-S2-06)", () => {
  // AC-38.02: Navigasi dari kartu ke detail dokumen
  test("AC-38.02: GET /documents/:id returns full detail with metadata and versions inline", async () => {
    const docId = asDocumentId("0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01");
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(tenantRequest(`/documents/${docId}`, { token: TOKENS.memberA }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: DocumentDetailView };
    expect(body.data.id).toBe(docId);
    expect(body.data.title).toBe("kontrak-kerjasama.pdf");
    expect(body.data.metadata).toEqual({
      author: "Legal Team",
      documentCreatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(body.data.versions).toBeDefined();
    expect(body.data.versions.length).toBeGreaterThan(0);
    expect(body.data.versions[0]?.isCurrent).toBe(true);
  });

  test("unknown document id returns 404 NOT_FOUND", async () => {
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest("/documents/00000000-0000-4000-8000-999999999999", {
        token: TOKENS.memberA,
      }),
    );
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });

    // An unknown id is a plain 404: no cross-tenant attempt, no audit event.
    const deniedEvents = app.activityRepository.events.filter((e) => e.action === "access.denied");
    expect(deniedEvents).toHaveLength(0);
  });

  test("cross-tenant document access returns 404 NOT_FOUND and writes access.denied audit event", async () => {
    const foreignDocId = asDocumentId("991ba4a4-6a73-5755-8118-260707e7d4d1");
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest(`/documents/${foreignDocId}`, { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });

    const deniedEvent = app.activityRepository.events.find(
      (e) => e.action === "access.denied" && e.tenantId === TENANT_A.id,
    );
    expect(deniedEvent).toBeDefined();
    expect(deniedEvent?.metadata).toEqual({ attemptedId: foreignDocId });
  });
});

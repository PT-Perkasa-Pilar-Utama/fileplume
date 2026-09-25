import { describe, expect, test } from "bun:test";
import { asDocumentId, asTenantId, asUserId, asVersionId } from "@archiva/shared";
import { createCatalogService } from "./service.ts";
import { inMemoryBlobStore } from "./testing/in-memory-blob-store.ts";
import { inMemoryCatalogRepository } from "./testing/in-memory-repository.ts";
import type { StoredDocument, StoredVersion } from "./testing/in-memory-types.ts";

const TENANT_1 = asTenantId("10000000-0000-4000-8000-000000000001");
const USER_MEMBER_1 = asUserId("00000000-0000-4000-8000-000000000011");
const USER_MEMBER_2 = asUserId("00000000-0000-4000-8000-000000000012");
const USER_HEAD = asUserId("00000000-0000-4000-8000-000000000013");

function setupHarness(initialDocs: StoredDocument[] = [], initialVers: StoredVersion[] = []) {
  const repository = inMemoryCatalogRepository({
    documents: initialDocs,
    versions: initialVers,
    seedFixtures: false,
  });
  const blobStore = inMemoryBlobStore();
  const service = createCatalogService({
    repository,
    blobStore,
    clock: { now: () => new Date("2026-09-15T10:00:00.000Z") },
    quota: {
      reserveQuota: async (t, bytes) => ({
        ok: true,
        value: { id: "res-1", tenantId: t, bytes },
      }),
      commitQuota: async () => {},
      releaseQuota: async () => {},
      revertCommit: async () => {},
      getMaxFileSizeMb: async () => 20,
    },
    queue: { enqueue: async () => {} },
    audit: { record: async () => {} },
    session: { validateSession: async () => true },
  });

  return { service, repository };
}

describe("AC-38.01: melihat dokumen terbaru sebagai kartu visual", () => {
  // AC-38.01: Setiap dokumen ditampilkan sebagai kartu visual berisi ikon tipe file, judul, tanggal unggah, nama pengunggah, status pemrosesan
  test("AC-38.01: list returns visual card fields and Indonesian processing label", async () => {
    const docId = asDocumentId("00000000-0000-4000-8000-000000000001");
    const verId = asVersionId("00000000-0000-4000-8000-000000000002");

    const doc: StoredDocument = {
      id: docId,
      tenantId: TENANT_1,
      title: "Laporan Keuangan Q3.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: verId,
      uploaderId: USER_MEMBER_1,
      uploaderName: "Budi Santoso",
      createdAt: new Date("2026-09-10T08:00:00.000Z"),
      categoryId: "00000000-0000-4000-8000-000000000099",
      categoryName: "Finance",
      categoryIsSystem: false,
      categoryConfirmedAt: new Date("2026-09-10T08:00:00.000Z"),
      categoryDownloadActive: true,
      documentType: "Laporan",
      tags: ["keuangan", "q3"],
      author: "Accounting",
      documentCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const ver: StoredVersion = {
      id: verId,
      tenantId: TENANT_1,
      documentId: docId,
      versionNumber: 1,
      contentHash: "hash-q3",
      blobKey: `t/${TENANT_1}/d/${docId}/v/${verId}`,
      filename: "Laporan Keuangan Q3.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1048576,
      pageCount: 12,
      uploadedById: USER_MEMBER_1,
      uploadedByName: "Budi Santoso",
      createdAt: doc.createdAt,
    };

    const { service } = setupHarness([doc], [ver]);

    const result = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_1, role: "member" },
      pendingConfirmationDays: 7,
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
    });

    expect(result.data).toHaveLength(1);
    const item = result.data[0];
    expect(item).toBeDefined();
    if (!item) return;

    expect(item.id).toBe(docId);
    expect(item.fileType).toBe("pdf");
    expect(item.title).toBe("Laporan Keuangan Q3.pdf");
    expect(item.createdAt).toBe("2026-09-10T08:00:00.000Z");
    expect(item.uploader).toEqual({ id: USER_MEMBER_1, name: "Budi Santoso" });
    expect(item.processingState).toBe("ready");
    expect(item.processingLabel).toBe("Siap");
  });

  test("AC-38.01: processing states map to Antre, Diproses, Siap, and Gagal labels", async () => {
    const states = [
      { state: "queued" as const, label: "Antre" },
      { state: "processing" as const, label: "Diproses" },
      { state: "ready" as const, label: "Siap" },
      { state: "failed" as const, label: "Gagal" },
    ];

    for (let i = 0; i < states.length; i++) {
      const entry = states[i];
      if (!entry) continue;
      const dId = asDocumentId(`00000000-0000-4000-8000-00000000001${i}`);
      const vId = asVersionId(`00000000-0000-4000-8000-00000000002${i}`);

      const doc: StoredDocument = {
        id: dId,
        tenantId: TENANT_1,
        title: `Doc ${i}.pdf`,
        processingState: entry.state,
        failureReason: entry.state === "failed" ? "password_protected" : null,
        currentVersionId: vId,
        uploaderId: USER_MEMBER_1,
        uploaderName: "User",
        createdAt: new Date(),
        categoryId: null,
        categoryName: null,
        categoryIsSystem: null,
        categoryConfirmedAt: new Date(),
        categoryDownloadActive: null,
        documentType: null,
        tags: [],
        author: null,
        documentCreatedAt: null,
      };
      const ver: StoredVersion = {
        id: vId,
        tenantId: TENANT_1,
        documentId: dId,
        versionNumber: 1,
        contentHash: `hash-${i}`,
        blobKey: `key-${i}`,
        filename: `Doc ${i}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 100,
        pageCount: 1,
        uploadedById: USER_MEMBER_1,
        uploadedByName: "User",
        createdAt: new Date(),
      };

      const { service } = setupHarness([doc], [ver]);
      const res = await service.listDocuments({
        tenantId: TENANT_1,
        viewer: { userId: USER_MEMBER_1, role: "member" },
        pendingConfirmationDays: 7,
        query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
      });

      const found = res.data[0];
      expect(found?.processingState).toBe(entry.state);
      expect(found?.processingLabel).toBe(entry.label);
      if (entry.state === "failed") {
        expect(found?.failureReason).toEqual({
          code: "password_protected",
          message: "Dokumen terproteksi password",
        });
      }
    }
  });

  test("AC-38.01: derives fileType docx, xlsx, txt correctly from mimeType", async () => {
    const mimeCases = [
      {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      },
      {
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileType: "xlsx",
      },
      { mime: "text/plain", fileType: "txt" },
    ] as const;

    for (const testCase of mimeCases) {
      const dId = asDocumentId(crypto.randomUUID());
      const vId = asVersionId(crypto.randomUUID());
      const doc: StoredDocument = {
        id: dId,
        tenantId: TENANT_1,
        title: "file",
        processingState: "ready",
        failureReason: null,
        currentVersionId: vId,
        uploaderId: USER_MEMBER_1,
        uploaderName: "User",
        createdAt: new Date(),
        categoryId: null,
        categoryName: null,
        categoryIsSystem: null,
        categoryConfirmedAt: new Date(),
        categoryDownloadActive: null,
        documentType: null,
        tags: [],
        author: null,
        documentCreatedAt: null,
      };
      const ver: StoredVersion = {
        id: vId,
        tenantId: TENANT_1,
        documentId: dId,
        versionNumber: 1,
        contentHash: crypto.randomUUID(),
        blobKey: "k",
        filename: "file",
        mimeType: testCase.mime,
        sizeBytes: 100,
        pageCount: 1,
        uploadedById: USER_MEMBER_1,
        uploadedByName: "User",
        createdAt: new Date(),
      };

      const { service } = setupHarness([doc], [ver]);
      const res = await service.listDocuments({
        tenantId: TENANT_1,
        viewer: { userId: USER_MEMBER_1, role: "member" },
        pendingConfirmationDays: 7,
        query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
      });

      expect(res.data[0]?.fileType).toBe(testCase.fileType);
    }
  });
});

describe("AC-38.02: navigasi dari kartu ke detail dokumen", () => {
  // AC-38.02: Halaman detail dokumen terbuka menampilkan metadata, extracted fields, dan versions newest-first
  test("AC-38.02: getDocument returns metadata and versions sorted newest first", async () => {
    const docId = asDocumentId("00000000-0000-4000-8000-000000000055");
    const v1Id = asVersionId("00000000-0000-4000-8000-000000000051");
    const v2Id = asVersionId("00000000-0000-4000-8000-000000000052");

    const doc: StoredDocument = {
      id: docId,
      tenantId: TENANT_1,
      title: "Proposal Kerjasama.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: v2Id,
      uploaderId: USER_MEMBER_1,
      uploaderName: "Budi Santoso",
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
      categoryId: "00000000-0000-4000-8000-000000000010",
      categoryName: "Proposal",
      categoryIsSystem: false,
      categoryConfirmedAt: new Date("2026-09-02T08:00:00.000Z"),
      categoryDownloadActive: true,
      documentType: "Proposal",
      tags: ["b2b", "kemitraan"],
      author: "Budi Santoso",
      documentCreatedAt: new Date("2026-08-30T10:00:00.000Z"),
    };

    const ver1: StoredVersion = {
      id: v1Id,
      tenantId: TENANT_1,
      documentId: docId,
      versionNumber: 1,
      contentHash: "hash-v1",
      blobKey: `t/${TENANT_1}/d/${docId}/v/${v1Id}`,
      filename: "Proposal Kerjasama v1.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100000,
      pageCount: 5,
      uploadedById: USER_MEMBER_1,
      uploadedByName: "Budi Santoso",
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
    };

    const ver2: StoredVersion = {
      id: v2Id,
      tenantId: TENANT_1,
      documentId: docId,
      versionNumber: 2,
      contentHash: "hash-v2",
      blobKey: `t/${TENANT_1}/d/${docId}/v/${v2Id}`,
      filename: "Proposal Kerjasama v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 120000,
      pageCount: 6,
      uploadedById: USER_HEAD,
      uploadedByName: "Siti Rahma",
      createdAt: new Date("2026-09-05T08:00:00.000Z"),
    };

    const { service } = setupHarness([doc], [ver1, ver2]);

    const result = await service.getDocument(
      TENANT_1,
      docId,
      {
        userId: USER_MEMBER_1,
        role: "member",
      },
      7,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.id).toBe(docId);
    expect(result.value.title).toBe("Proposal Kerjasama.pdf");
    expect(result.value.metadata).toEqual({
      author: "Budi Santoso",
      documentCreatedAt: "2026-08-30T10:00:00.000Z",
    });
    expect(result.value.versions).toHaveLength(2);
    expect(result.value.versions[0]?.versionNumber).toBe(2);
    expect(result.value.versions[0]?.isCurrent).toBe(true);
    expect(result.value.versions[0]?.uploadedBy.name).toBe("Siti Rahma");
    expect(result.value.versions[1]?.versionNumber).toBe(1);
    expect(result.value.versions[1]?.isCurrent).toBe(false);
  });
});

describe("AC-38.03: dasbor tanpa dokumen", () => {
  // AC-38.03: Tenant belum memiliki dokumen sama sekali -> "Belum ada dokumen. Seret file ke area unggah untuk memulai"
  test("AC-38.03: empty tenant returns 200 with verbatim empty message in meta", async () => {
    const { service } = setupHarness([]);

    const result = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_1, role: "member" },
      pendingConfirmationDays: 7,
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
    });

    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.message).toBe("Belum ada dokumen. Seret file ke area unggah untuk memulai");
  });

  // AC-34.03: Kategori filter kosong saat tenant punya dokumen
  test("AC-34.03: category filter matching nothing returns exact category empty message", async () => {
    const docId = asDocumentId("00000000-0000-4000-8000-000000000001");
    const verId = asVersionId("00000000-0000-4000-8000-000000000002");
    const doc: StoredDocument = {
      id: docId,
      tenantId: TENANT_1,
      title: "Doc.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: verId,
      uploaderId: USER_MEMBER_1,
      uploaderName: "User",
      createdAt: new Date(),
      categoryId: "00000000-0000-4000-8000-000000000001",
      categoryName: "Cat A",
      categoryIsSystem: false,
      categoryConfirmedAt: new Date(),
      categoryDownloadActive: true,
      documentType: null,
      tags: [],
      author: null,
      documentCreatedAt: null,
    };
    const ver: StoredVersion = {
      id: verId,
      tenantId: TENANT_1,
      documentId: docId,
      versionNumber: 1,
      contentHash: "hash-1",
      blobKey: "k-1",
      filename: "Doc.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pageCount: 1,
      uploadedById: USER_MEMBER_1,
      uploadedByName: "User",
      createdAt: new Date(),
    };

    const { service } = setupHarness([doc], [ver]);

    const result = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_1, role: "member" },
      pendingConfirmationDays: 7,
      query: {
        page: 1,
        limit: 10,
        sort: "createdAt",
        order: "desc",
        categoryId: "00000000-0000-4000-8000-000000000999",
      },
    });

    expect(result.data).toHaveLength(0);
    expect(result.meta.message).toBe("Tidak ada dokumen pada kategori ini");
  });

  // AC-05.04: Tag filter kosong saat tenant punya dokumen
  test("AC-05.04: tag filter matching nothing returns exact tag empty message", async () => {
    const docId = asDocumentId("00000000-0000-4000-8000-000000000001");
    const verId = asVersionId("00000000-0000-4000-8000-000000000002");
    const doc: StoredDocument = {
      id: docId,
      tenantId: TENANT_1,
      title: "Doc.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: verId,
      uploaderId: USER_MEMBER_1,
      uploaderName: "User",
      createdAt: new Date(),
      categoryId: null,
      categoryName: null,
      categoryIsSystem: null,
      categoryConfirmedAt: new Date(),
      categoryDownloadActive: null,
      documentType: null,
      tags: ["finance"],
      author: null,
      documentCreatedAt: null,
    };
    const ver: StoredVersion = {
      id: verId,
      tenantId: TENANT_1,
      documentId: docId,
      versionNumber: 1,
      contentHash: "hash-1",
      blobKey: "k-1",
      filename: "Doc.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pageCount: 1,
      uploadedById: USER_MEMBER_1,
      uploadedByName: "User",
      createdAt: new Date(),
    };

    const { service } = setupHarness([doc], [ver]);

    const result = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_1, role: "member" },
      pendingConfirmationDays: 7,
      query: {
        page: 1,
        limit: 10,
        sort: "createdAt",
        order: "desc",
        tags: ["nonexistent-tag"],
      },
    });

    expect(result.data).toHaveLength(0);
    expect(result.meta.message).toBe("Tidak ada dokumen dengan kombinasi tag ini");
  });
});

describe("confirmation window predicate (5.4.1)", () => {
  test("fresh unconfirmed document is visible only to its uploader, hidden from colleague", async () => {
    const docId = asDocumentId("00000000-0000-4000-8000-000000000077");
    const verId = asVersionId("00000000-0000-4000-8000-000000000078");

    const doc: StoredDocument = {
      id: docId,
      tenantId: TENANT_1,
      title: "Fresh Unconfirmed.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: verId,
      uploaderId: USER_MEMBER_1,
      uploaderName: "Budi",
      createdAt: new Date("2026-09-14T00:00:00.000Z"), // 1 day old (< 7 days)
      categoryId: null,
      categoryName: null,
      categoryIsSystem: null,
      categoryConfirmedAt: null, // unconfirmed
      categoryDownloadActive: null,
      documentType: null,
      tags: [],
      author: null,
      documentCreatedAt: null,
    };
    const ver: StoredVersion = {
      id: verId,
      tenantId: TENANT_1,
      documentId: docId,
      versionNumber: 1,
      contentHash: "hash-fresh",
      blobKey: "k-fresh",
      filename: "Fresh Unconfirmed.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pageCount: 1,
      uploadedById: USER_MEMBER_1,
      uploadedByName: "Budi",
      createdAt: doc.createdAt,
    };

    const { service } = setupHarness([doc], [ver]);

    // Uploader sees it
    const uploaderRes = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_1, role: "member" },
      pendingConfirmationDays: 7,
      now: new Date("2026-09-15T00:00:00.000Z"),
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
    });
    expect(uploaderRes.data).toHaveLength(1);

    // Colleague does NOT see it in list
    const colleagueRes = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_2, role: "member" },
      pendingConfirmationDays: 7,
      now: new Date("2026-09-15T00:00:00.000Z"),
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
    });
    expect(colleagueRes.data).toHaveLength(0);

    // Colleague gets NotFound on direct access (404, never 403)
    const directRes = await service.getDocument(
      TENANT_1,
      docId,
      { userId: USER_MEMBER_2, role: "member" },
      7,
      new Date("2026-09-15T00:00:00.000Z"),
    );
    expect(directRes.ok).toBe(false);

    // Head of Team bypasses the window and sees it immediately
    const headRes = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_HEAD, role: "head_of_team" },
      pendingConfirmationDays: 7,
      now: new Date("2026-09-15T00:00:00.000Z"),
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
    });
    expect(headRes.data).toHaveLength(1);
  });
});

describe("in-memory adapter mirrors the SQL adapter", () => {
  function taggedDoc(tag: string): { doc: StoredDocument; ver: StoredVersion } {
    const docId = asDocumentId(crypto.randomUUID());
    const verId = asVersionId(crypto.randomUUID());
    const createdAt = new Date("2026-09-10T08:00:00.000Z");
    return {
      doc: {
        id: docId,
        tenantId: TENANT_1,
        title: "Tagged.pdf",
        processingState: "ready",
        failureReason: null,
        currentVersionId: verId,
        uploaderId: USER_MEMBER_1,
        uploaderName: "User",
        createdAt,
        categoryId: null,
        categoryName: null,
        categoryIsSystem: null,
        categoryConfirmedAt: new Date("2026-09-10T08:00:00.000Z"),
        categoryDownloadActive: null,
        documentType: null,
        tags: [tag],
        author: null,
        documentCreatedAt: null,
      },
      ver: {
        id: verId,
        tenantId: TENANT_1,
        documentId: docId,
        versionNumber: 1,
        contentHash: crypto.randomUUID(),
        blobKey: crypto.randomUUID(),
        filename: "Tagged.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        pageCount: 1,
        uploadedById: USER_MEMBER_1,
        uploadedByName: "User",
        createdAt,
      },
    };
  }

  test("tag filter is an exact match, like the SQL EXISTS subquery", async () => {
    const { doc, ver } = taggedDoc("Legal");
    const { service } = setupHarness([doc], [ver]);
    const viewer = { userId: USER_MEMBER_1, role: "member" as const };

    const exact = await service.listDocuments({
      tenantId: TENANT_1,
      viewer,
      pendingConfirmationDays: 7,
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc", tags: ["Legal"] },
    });
    expect(exact.data).toHaveLength(1);

    const lowered = await service.listDocuments({
      tenantId: TENANT_1,
      viewer,
      pendingConfirmationDays: 7,
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc", tags: ["legal"] },
    });
    expect(lowered.data).toHaveLength(0);
    expect(lowered.meta.message).toBe("Tidak ada dokumen dengan kombinasi tag ini");
  });

  test("equal sort keys break ties by id descending, like the SQL adapter", async () => {
    const createdAt = new Date("2026-09-10T08:00:00.000Z");
    const lowId = asDocumentId("00000000-0000-4000-8000-000000000081");
    const highId = asDocumentId("00000000-0000-4000-8000-000000000082");
    const lowVerId = asVersionId("00000000-0000-4000-8000-000000000091");
    const highVerId = asVersionId("00000000-0000-4000-8000-000000000092");
    const makeDoc = (id: typeof lowId, verId: typeof lowVerId): StoredDocument => ({
      id,
      tenantId: TENANT_1,
      title: "Same time.pdf",
      processingState: "ready",
      failureReason: null,
      currentVersionId: verId,
      uploaderId: USER_MEMBER_1,
      uploaderName: "User",
      createdAt,
      categoryId: null,
      categoryName: null,
      categoryIsSystem: null,
      categoryConfirmedAt: new Date("2026-09-10T08:00:00.000Z"),
      categoryDownloadActive: null,
      documentType: null,
      tags: [],
      author: null,
      documentCreatedAt: null,
    });
    const low = makeDoc(lowId, lowVerId);
    const high = makeDoc(highId, highVerId);
    const { service } = setupHarness(
      [low, high],
      [low, high].map((d) => ({
        id: d.currentVersionId ?? asVersionId(crypto.randomUUID()),
        tenantId: TENANT_1,
        documentId: d.id,
        versionNumber: 1,
        contentHash: crypto.randomUUID(),
        blobKey: crypto.randomUUID(),
        filename: "Same time.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        pageCount: 1,
        uploadedById: USER_MEMBER_1,
        uploadedByName: "User",
        createdAt,
      })),
    );

    const res = await service.listDocuments({
      tenantId: TENANT_1,
      viewer: { userId: USER_MEMBER_1, role: "member" },
      pendingConfirmationDays: 7,
      query: { page: 1, limit: 10, sort: "createdAt", order: "desc" },
    });
    expect(res.data).toHaveLength(2);
    expect(res.data[0]?.id).toBe(highId);
    expect(res.data[1]?.id).toBe(lowId);
  });
});

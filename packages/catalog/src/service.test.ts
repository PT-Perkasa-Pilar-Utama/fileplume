import { describe, expect, test } from "bun:test";
import {
  assertBlobKeyPrefix,
  belongsToTenant,
  blobKey,
  InvalidBlobKeyPrefixError,
} from "./internal/blob-key.ts";
import { ACCEPTED_MIME, isAcceptedType, MAX_BATCH, MAX_BULK_DOWNLOAD } from "./service.ts";
import {
  createTestHarness,
  jpgStream,
  pdfStream,
  TENANT_ID,
  USER_ID,
} from "./testing/test-harness.ts";

describe("accepted types", () => {
  test("accepts the four documented formats", () => {
    // AC-01.03 names PDF, DOCX, XLSX and TXT.
    expect(ACCEPTED_MIME).toHaveLength(4);
    expect(isAcceptedType("application/pdf")).toBe(true);
    expect(isAcceptedType("text/plain")).toBe(true);
  });

  test("rejects an image", () => {
    expect(isAcceptedType("image/jpeg")).toBe(false);
  });
});

describe("limits", () => {
  test("batch cap is 20 and bulk download cap is 50", () => {
    // AC-01.05 and AC-11.03.
    expect(MAX_BATCH).toBe(20);
    expect(MAX_BULK_DOWNLOAD).toBe(50);
  });
});

describe("blob keys", () => {
  test("are built from ids, never from the filename", () => {
    // technical-specs/07-security.md 7.5, path traversal.
    const key = blobKey("t1", "d1", "v1");
    expect(key).toBe("t/t1/d/d1/v/v1");
    expect(key).not.toContain("..");
  });

  test("carry a tenant prefix the adapter can refuse on", () => {
    expect(belongsToTenant(blobKey("t1", "d1", "v1"), "t1")).toBe(true);
    expect(belongsToTenant(blobKey("t1", "d1", "v1"), "t2")).toBe(false);
  });

  test("assertBlobKeyPrefix accepts a key matching the tenant", () => {
    expect(() => assertBlobKeyPrefix(blobKey("tenant-1", "doc-1", "v1"), "tenant-1")).not.toThrow();
  });

  test("assertBlobKeyPrefix throws InvalidBlobKeyPrefixError for a foreign tenant key", () => {
    expect(() => assertBlobKeyPrefix(blobKey("tenant-1", "doc-1", "v1"), "tenant-2")).toThrow(
      InvalidBlobKeyPrefixError,
    );
  });
});

describe("single upload", () => {
  test("AC-01.02: uploaded file is stored in repository and enqueued", async () => {
    const { service, repository, enqueuedJobs, committedReservations } = createTestHarness();
    const file = pdfStream("laporan tahunan");

    const res = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "laporan.pdf",
      stream: file.stream,
      sizeBytes: file.sizeBytes,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(repository.documents).toHaveLength(1);
    expect(repository.documents[0]?.title).toBe("laporan.pdf");
    expect(repository.documents[0]?.processingState).toBe("queued");
    expect(enqueuedJobs).toContain(res.value.id);
    expect(committedReservations).toHaveLength(1);
  });

  test("AC-03.02: non-duplicate file is stored when other files already exist", async () => {
    const { service, repository } = createTestHarness();
    const file1 = pdfStream("laporan keuangan");
    const file2 = pdfStream("presentasi baru");

    await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "laporan-keuangan.pdf",
      stream: file1.stream,
      sizeBytes: file1.sizeBytes,
    });

    const res2 = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "presentasi-baru.pdf",
      stream: file2.stream,
      sizeBytes: file2.sizeBytes,
    });

    expect(res2.ok).toBe(true);
    expect(repository.documents).toHaveLength(2);
  });

  test("AC-03.03: same filename with different content creates separate documents", async () => {
    const { service, repository } = createTestHarness();
    const file1 = pdfStream("konten pertama laporan");
    const file2 = pdfStream("konten kedua laporan berbeda");

    const res1 = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "laporan.pdf",
      stream: file1.stream,
      sizeBytes: file1.sizeBytes,
    });

    const res2 = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "laporan.pdf",
      stream: file2.stream,
      sizeBytes: file2.sizeBytes,
    });

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (!res1.ok || !res2.ok) return;
    expect(res1.value.id).not.toBe(res2.value.id);
    expect(repository.documents).toHaveLength(2);
    expect(repository.documents[0]?.title).toBe("laporan.pdf");
    expect(repository.documents[1]?.title).toBe("laporan.pdf");
  });

  test("AC-03.04: the second of two identical uploads loses and stores nothing", async () => {
    // Atomicity is decided by UNIQUE (tenant_id, content_hash) in the Drizzle
    // repository; the in-memory double models the losing outcome, not the race.
    const { service, repository } = createTestHarness();

    const first = pdfStream("konten identik");
    const res1 = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-a.pdf",
      stream: first.stream,
      sizeBytes: first.sizeBytes,
    });

    const second = pdfStream("konten identik");
    const res2 = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-b.pdf",
      stream: second.stream,
      sizeBytes: second.sizeBytes,
    });

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(false);
    if (!res1.ok || res2.ok) return;
    expect(res2.error).toEqual({ kind: "DuplicateContent", existingDocumentId: res1.value.id });
    expect(repository.documents).toHaveLength(1);
  });
});

describe("upload error mapping", () => {
  test("an oversized file maps to TooLarge carrying the tenant limit", async () => {
    const { service } = createTestHarness({ maxFileSizeMb: 20 });
    const file = pdfStream("oversized content");

    const res = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "berkas-besar.pdf",
      stream: file.stream,
      sizeBytes: 25 * 1024 * 1024,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("TooLarge");
    if (res.error.kind === "TooLarge") {
      expect(res.error.limitMb).toBe(20);
    }
  });

  test("an unsupported file maps to UnsupportedType", async () => {
    const { service } = createTestHarness();
    const file = jpgStream();

    const res = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "foto.jpg",
      stream: file.stream,
      sizeBytes: file.sizeBytes,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("UnsupportedType");
  });

  test("refused quota maps to QuotaExceeded", async () => {
    const { service } = createTestHarness({ quotaAvailable: false });
    const file = pdfStream("laporan kuota");

    const res = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "laporan.pdf",
      stream: file.stream,
      sizeBytes: file.sizeBytes,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("QuotaExceeded");
  });
});

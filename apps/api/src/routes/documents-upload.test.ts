import { describe, expect, test } from "bun:test";
import type { UploadBatch } from "@archiva/shared";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";
import { docxFile, jpgFile, oversizedPdfFile, pdfFile } from "./internal/upload-fixtures.ts";

describe("POST /documents (BE-S2-01)", () => {
  test("AC-01.01: single valid PDF multipart upload returns 201 and Antre label", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("files", pdfFile("laporan.pdf", "laporan keuangan"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: UploadBatch };
    expect(body.data.accepted).toBe(1);
    expect(body.data.rejected).toBe(0);
    expect(body.data.summary).toBeNull();
    const first = body.data.results[0];
    expect(first?.status).toBe("accepted");
    if (first?.status === "accepted") {
      expect(first.document.processingState).toBe("queued");
      expect(first.document.processingLabel).toBe("Antre");
      expect(first.document.title).toBe("laporan.pdf");
    }
  });

  test("AC-01.02: document is stored and audit event recorded", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("files", pdfFile("laporan-tersimpan.pdf", "data tersimpan"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(201);
    expect(app.catalogRepository.documents).toHaveLength(1);
    expect(app.catalogRepository.documents[0]?.title).toBe("laporan-tersimpan.pdf");

    const audit = app.activityRepository.events.find((e) => e.action === "document.upload");
    expect(audit).toBeDefined();
    expect(audit?.outcome).toBe("allowed");
  });

  test("AC-01.03: unsupported file (.jpg) returns 422 with UNSUPPORTED_TYPE", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("files", jpgFile("foto.jpg"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { data: UploadBatch };
    expect(body.data.accepted).toBe(0);
    expect(body.data.rejected).toBe(1);
    const first = body.data.results[0];
    expect(first?.status).toBe("rejected");
    if (first?.status === "rejected") {
      expect(first.error.code).toBe("UNSUPPORTED_TYPE");
      expect(first.error.message).toBe(
        "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT",
      );
    }
  });

  test("AC-01.04: multiple files (3 DOCX) uploaded together are all accepted", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("files", docxFile("doc1.docx", "konten 1"));
    formData.append("files", docxFile("doc2.docx", "konten 2"));
    formData.append("files", docxFile("doc3.docx", "konten 3"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: UploadBatch };
    expect(body.data.accepted).toBe(3);
    expect(body.data.rejected).toBe(0);
  });

  test("AC-01.05: more than 20 files returns 422 BATCH_TOO_LARGE", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    for (let i = 0; i < 21; i++) {
      formData.append("files", pdfFile(`doc-${i}.pdf`, `content ${i}`));
    }

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const err = await errorOf(res);
    expect(err.code).toBe("BATCH_TOO_LARGE");
    expect(err.message).toBe("Maksimal 20 file per unggahan");
  });

  test("AC-01.06: file exceeding max limit returns 422 FILE_TOO_LARGE", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    const file = oversizedPdfFile("berkas-25mb.pdf");
    formData.append("files", file);

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { data: UploadBatch };
    expect(body.data.accepted).toBe(0);
    expect(body.data.rejected).toBe(1);
    const first = body.data.results[0];
    expect(first?.status).toBe("rejected");
    if (first?.status === "rejected") {
      expect(first.error.code).toBe("FILE_TOO_LARGE");
      expect(first.error.message).toBe("Ukuran file melebihi batas 20 MB");
    }
  });

  test("AC-03.02: non-duplicate file is accepted when other files exist", async () => {
    const app = buildTestApp();

    const fd1 = new FormData();
    fd1.append("files", pdfFile("doc1.pdf", "konten pertama"));
    await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fd1,
      }),
    );

    const fd2 = new FormData();
    fd2.append("files", pdfFile("doc2.pdf", "konten kedua berbeda"));
    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fd2,
      }),
    );

    expect(res.status).toBe(201);
    expect(app.catalogRepository.documents).toHaveLength(2);
  });

  test("AC-03.03: same filename with different content creates separate documents", async () => {
    const app = buildTestApp();

    const fd1 = new FormData();
    fd1.append("files", pdfFile("laporan.pdf", "konten user A"));
    const res1 = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fd1,
      }),
    );

    const fd2 = new FormData();
    fd2.append("files", pdfFile("laporan.pdf", "konten user B berbeda"));
    const res2 = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fd2,
      }),
    );

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(app.catalogRepository.documents).toHaveLength(2);
    expect(app.catalogRepository.documents[0]?.id).not.toBe(app.catalogRepository.documents[1]?.id);
  });

  test("AC-01.08: expired session returns 401", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("files", pdfFile("laporan.pdf", "konten"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.idleA,
        body: formData,
      }),
    );

    expect(res.status).toBe(401);
  });

  test("AC-03.01: re-uploading identical content returns 422 DUPLICATE_CONTENT with a link", async () => {
    const app = buildTestApp();

    const fd1 = new FormData();
    fd1.append("files", pdfFile("laporan.pdf", "konten sama persis"));
    const res1 = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fd1,
      }),
    );
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { data: UploadBatch };
    const accepted = body1.data.results[0];
    expect(accepted?.status).toBe("accepted");
    if (accepted?.status !== "accepted") return;

    const fd2 = new FormData();
    fd2.append("files", pdfFile("salinan.pdf", "konten sama persis"));
    const res2 = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: fd2,
      }),
    );

    expect(res2.status).toBe(422);
    const body2 = (await res2.json()) as { data: UploadBatch };
    expect(body2.data.accepted).toBe(0);
    expect(body2.data.rejected).toBe(1);
    const outcome = body2.data.results[0];
    expect(outcome?.status).toBe("rejected");
    if (outcome?.status === "rejected") {
      expect(outcome.error.code).toBe("DUPLICATE_CONTENT");
      expect(outcome.error.message).toBe("File ini sudah ada di sistem");
      expect(outcome.error.existingDocumentId).toBe(accepted.document.id);
    }
    expect(app.catalogRepository.documents).toHaveLength(1);
  });

  // 5.2 step 3c: reservation refused stores nothing. Message follows the
  // 05-documents.md contract ("Kapasitas penyimpanan penuh"); the longer
  // AC-35.03 business text is a known docs conflict, deferred to BE-S2-02.
  test("exhausted quota returns 422 QUOTA_EXCEEDED and stores nothing", async () => {
    const app = buildTestApp(undefined, { tenancyQuotaBytes: 10 });
    const formData = new FormData();
    formData.append("files", pdfFile("laporan.pdf", "konten"));

    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { data: UploadBatch };
    expect(body.data.accepted).toBe(0);
    expect(body.data.rejected).toBe(1);
    const outcome = body.data.results[0];
    expect(outcome?.status).toBe("rejected");
    if (outcome?.status === "rejected") {
      expect(outcome.error.code).toBe("QUOTA_EXCEEDED");
      expect(outcome.error.message).toBe("Kapasitas penyimpanan penuh");
    }
    expect(app.catalogRepository.documents).toHaveLength(0);
  });
});

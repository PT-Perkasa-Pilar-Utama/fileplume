import { describe, expect, test } from "bun:test";
import type { DocumentDetailView, DocumentVersionView } from "@archiva/shared";
import {
  buildTestApp,
  errorOf,
  RAHASIA_B_DOC_ID,
  TOKENS,
  tenantRequest,
} from "../testing/test-app.ts";
import { jpgFile, pdfFile } from "./internal/upload-fixtures.ts";

describe("POST and GET /documents/:id/versions (BE-S2-04)", () => {
  async function seedDocument(
    app: ReturnType<typeof buildTestApp>,
    filename = "proposal.pdf",
    content = "konten versi satu",
  ) {
    const formData = new FormData();
    formData.append("files", pdfFile(filename, content));
    const res = await app.request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { results: Array<{ document?: { id: string } }> } };
    const docId = body.data.results[0]?.document?.id;
    if (!docId) throw new Error("Seed upload failed");
    return docId;
  }

  test("AC-21.01: member uploads new version via explicit action and receives 201 with v2", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten v1");

    const formData = new FormData();
    formData.append("file", pdfFile("proposal-revisi.pdf", "konten revisi berbeda v2"));

    const res = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: DocumentDetailView };
    expect(body.data.id).toBe(docId);
    expect(body.data.versionNumber).toBe(2);
    expect(body.data.versionCount).toBe(2);
    expect(body.data.versions).toHaveLength(2);

    // Audit event recorded
    const audit = app.activityRepository.events.find(
      (e) => e.action === "document.version_add" && e.subjectId === docId,
    );
    expect(audit).toBeDefined();
    expect(audit?.outcome).toBe("allowed");
  });

  test("AC-21.02: old versions can be accessed via GET /documents/:id/versions, newest first", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten v1");

    // Upload v2
    const formV2 = new FormData();
    formV2.append("file", pdfFile("proposal-v2.pdf", "konten v2"));
    await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formV2,
      }),
    );

    // Upload v3
    const formV3 = new FormData();
    formV3.append("file", pdfFile("proposal-v3.pdf", "konten v3"));
    await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formV3,
      }),
    );

    const res = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "GET",
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: DocumentVersionView[]; meta: { total: number } };
    expect(body.data).toHaveLength(3);
    expect(body.meta.total).toBe(3);
    expect(body.data[0]?.versionNumber).toBe(3);
    expect(body.data[0]?.isCurrent).toBe(true);
    expect(body.data[1]?.versionNumber).toBe(2);
    expect(body.data[1]?.isCurrent).toBe(false);
    expect(body.data[2]?.versionNumber).toBe(1);
    expect(body.data[2]?.isCurrent).toBe(false);
  });

  test("AC-21.03: identical content against current version returns 409 and exact Indonesian message", async () => {
    const app = buildTestApp();
    const identicalText = "konten proposal sama persis";
    const docId = await seedDocument(app, "proposal.pdf", identicalText);

    const formData = new FormData();
    formData.append("file", pdfFile("proposal-sama.pdf", identicalText));

    const res = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(409);
    const err = await errorOf(res);
    expect(err).toEqual({
      code: "IDENTICAL_CONTENT",
      message: "Isi file sama dengan versi yang sudah ada",
    });

    // Verify no new version is created in repository
    expect(app.catalogRepository.versions).toHaveLength(1);
  });

  test("AC-21.04: two concurrent version uploads result in consecutive version numbers", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten dasar");

    const formA = new FormData();
    formA.append("file", pdfFile("proposal-a.pdf", "konten cabang A"));

    const formB = new FormData();
    formB.append("file", pdfFile("proposal-b.pdf", "konten cabang B"));

    const [resA, resB] = await Promise.all([
      app.request(
        tenantRequest(`/documents/${docId}/versions`, {
          method: "POST",
          token: TOKENS.memberA,
          body: formA,
        }),
      ),
      app.request(
        tenantRequest(`/documents/${docId}/versions`, {
          method: "POST",
          token: TOKENS.memberA,
          body: formB,
        }),
      ),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    const versions = app.catalogRepository.versions
      .filter((v) => v.documentId === docId)
      .map((v) => v.versionNumber)
      .sort((a, b) => a - b);

    expect(versions).toEqual([1, 2, 3]);
  });

  test("cross-tenant: attempting to add version to another tenant document returns 404 and writes access.denied", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("file", pdfFile("serangan.pdf", "konten asing"));

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(404);
    const err = await errorOf(res);
    expect(err.code).toBe("NOT_FOUND");

    const denied = app.activityRepository.events.find(
      (e) => e.action === "access.denied" && e.outcome === "denied",
    );
    expect(denied).toBeDefined();
    expect(denied?.metadata).toEqual({ attemptedId: RAHASIA_B_DOC_ID });
  });

  test("error: unsupported file type (.jpg) returns 422 UNSUPPORTED_TYPE", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten awal");

    const formData = new FormData();
    formData.append("file", jpgFile("foto.jpg"));

    const res = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const err = await errorOf(res);
    expect(err.code).toBe("UNSUPPORTED_TYPE");
    expect(err.message).toBe("Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT");
  });

  test("error: missing file part returns 422 VALIDATION_ERROR", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten awal");

    const formData = new FormData();
    formData.append("wrong_field", pdfFile("doc.pdf", "konten"));

    const res = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const err = await errorOf(res);
    expect(err.code).toBe("VALIDATION_ERROR");
  });
});

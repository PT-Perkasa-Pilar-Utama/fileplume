import { describe, expect, test } from "bun:test";
import { asDocumentId } from "@archiva/shared";
import { buildTestApp, errorOf, TENANT_A, TOKENS, tenantRequest } from "../testing/test-app.ts";
import { pdfFile } from "./internal/upload-fixtures.ts";

describe("POST and GET /documents/:id/versions validation & access", () => {
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
    const processingDoc = await app.catalogRepository.findDocumentForProcessing(
      TENANT_A.id,
      asDocumentId(docId),
    );
    if (processingDoc) {
      await app.catalogRepository.claimQueuedDocument(TENANT_A.id, asDocumentId(docId));
      await app.catalogRepository.markScanComplete(
        TENANT_A.id,
        asDocumentId(docId),
        processingDoc.currentVersionId,
      );
    }
    return docId;
  }

  test("error: non-UUID :id on POST /documents/:id/versions returns 422 VALIDATION_ERROR", async () => {
    const app = buildTestApp();
    const formData = new FormData();
    formData.append("file", pdfFile("doc.pdf", "konten"));

    const res = await app.request(
      tenantRequest("/documents/not-a-uuid/versions", {
        method: "POST",
        token: TOKENS.memberA,
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const err = await errorOf(res);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  test("confirmation window: second member gets 404 on window-hidden document, head_of_team gets 200/201 (05-documents.md 5.4.1)", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten rahasia member A");

    const getResB = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "GET",
        token: TOKENS.memberB,
      }),
    );
    expect(getResB.status).toBe(404);

    const formB = new FormData();
    formB.append("file", pdfFile("revisi-b.pdf", "konten baru dari member B"));
    const postResB = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberB,
        body: formB,
      }),
    );
    expect(postResB.status).toBe(404);

    const getResHead = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "GET",
        token: TOKENS.headOfTeamA,
      }),
    );
    expect(getResHead.status).toBe(200);

    const formHead = new FormData();
    formHead.append("file", pdfFile("revisi-head.pdf", "konten baru dari head of team"));
    const postResHead = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.headOfTeamA,
        body: formHead,
      }),
    );
    expect(postResHead.status).toBe(201);
  });
});

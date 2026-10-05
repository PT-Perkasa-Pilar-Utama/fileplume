import { describe, expect, test } from "bun:test";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";
import { jpgFile, pdfFile } from "./internal/upload-fixtures.ts";

describe("POST /documents/:id/versions error paths", () => {
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

  test("error: content matching an older version returns 409 DUPLICATE_CONTENT (06-data-model.md 6.6)", async () => {
    const app = buildTestApp();
    const docId = await seedDocument(app, "proposal.pdf", "konten versi satu");

    const formV2 = new FormData();
    formV2.append("file", pdfFile("proposal-v2.pdf", "konten versi dua"));
    const resV2 = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formV2,
      }),
    );
    expect(resV2.status).toBe(201);

    const formV3 = new FormData();
    formV3.append("file", pdfFile("proposal-v3.pdf", "konten versi satu"));
    const resV3 = await app.request(
      tenantRequest(`/documents/${docId}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        body: formV3,
      }),
    );

    expect(resV3.status).toBe(409);
    const err = await errorOf(resV3);
    expect(err).toEqual({
      code: "DUPLICATE_CONTENT",
      message: "File ini sudah ada di sistem",
    });
  });
});

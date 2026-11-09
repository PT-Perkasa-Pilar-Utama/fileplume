import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, TenantId, UserId, VersionId } from "@archiva/shared";
import { asDocumentId, asTenantId, asUserId, asVersionId } from "@archiva/shared";
import { and, asc, eq } from "drizzle-orm";
import { createExtractionRepository } from "./extraction-repository.ts";
import { startTestDatabase } from "./test-database.ts";

type SeededVersion = {
  tenantId: TenantId;
  documentId: DocumentId;
  uploaderId: UserId;
  versionId: VersionId;
};

describe("createExtractionRepository", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const started = await startTestDatabase();
    db = started.db;
    stop = started.stop;
  }, 120_000);

  afterAll(async () => {
    await stop();
  });

  async function seedVersion(): Promise<SeededVersion> {
    const slug = crypto.randomUUID().slice(0, 8);
    const tenant = await db
      .insert(schema.tenants)
      .values({ name: `Extract ${slug}`, subdomain: `ext-${slug}` })
      .returning({ id: schema.tenants.id });
    const tenantRow = tenant[0];
    if (!tenantRow) throw new Error("seedVersion: tenant insert returned no row");
    const tenantId = asTenantId(tenantRow.id);
    const user = await db
      .insert(schema.users)
      .values({
        tenantId,
        email: `${slug}@example.test`,
        passwordHash: "not-a-real-hash",
        name: "Extract User",
      })
      .returning({ id: schema.users.id });
    const userRow = user[0];
    if (!userRow) throw new Error("seedVersion: user insert returned no row");
    const uploaderId = asUserId(userRow.id);
    const document = await db
      .insert(schema.documents)
      .values({ tenantId, uploaderId, title: "contract.pdf", processingState: "processing" })
      .returning({ id: schema.documents.id });
    const documentRow = document[0];
    if (!documentRow) throw new Error("seedVersion: document insert returned no row");
    const documentId = asDocumentId(documentRow.id);
    const versionId = await insertVersion({ tenantId, documentId, uploaderId, versionNumber: 1 });
    await db
      .update(schema.documents)
      .set({ currentVersionId: versionId })
      .where(eq(schema.documents.id, documentId));
    return { tenantId, documentId, uploaderId, versionId };
  }

  async function insertVersion(run: {
    tenantId: TenantId;
    documentId: DocumentId;
    uploaderId: UserId;
    versionNumber: number;
  }): Promise<VersionId> {
    const version = await db
      .insert(schema.documentVersions)
      .values({
        tenantId: run.tenantId,
        documentId: run.documentId,
        versionNumber: run.versionNumber,
        contentHash: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
        filename: `contract-v${run.versionNumber}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 2048,
        blobKey: `t/${run.tenantId}/d/${run.documentId}/v/${crypto.randomUUID()}`,
        uploadedBy: run.uploaderId,
      })
      .returning({ id: schema.documentVersions.id });
    const row = version[0];
    if (!row) throw new Error("insertVersion: version insert returned no row");
    return asVersionId(row.id);
  }

  async function pageText(versionId: VersionId): Promise<string[]> {
    const rows = await db
      .select({ content: schema.documentPages.content })
      .from(schema.documentPages)
      .where(eq(schema.documentPages.versionId, versionId))
      .orderBy(asc(schema.documentPages.pageNumber));
    return rows.map((row) => row.content);
  }

  async function pageCount(versionId: VersionId): Promise<number | null> {
    const [row] = await db
      .select({ pageCount: schema.documentVersions.pageCount })
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.id, versionId))
      .limit(1);
    return row?.pageCount ?? null;
  }

  test("AC-33.01: stores one ordered page row per page, plus text metadata", async () => {
    const repository = createExtractionRepository(db);
    const run = await seedVersion();
    await repository.replaceExtractedText({
      ...run,
      pages: ["Halaman satu", "Halaman dua"],
      method: "native",
      language: "ind",
    });

    expect(await pageText(run.versionId)).toEqual(["Halaman satu", "Halaman dua"]);
    expect(await pageCount(run.versionId)).toBe(2);
    const text = await db
      .select()
      .from(schema.documentText)
      .where(eq(schema.documentText.versionId, run.versionId));
    expect(text[0]).toMatchObject({
      tenantId: run.tenantId,
      extractionMethod: "native",
      language: "ind",
      charCount: 23,
    });
  });

  test("AC-44.02: reprocessing a version replaces its rows instead of duplicating them", async () => {
    const repository = createExtractionRepository(db);
    const run = await seedVersion();
    await repository.replaceExtractedText({
      ...run,
      pages: ["Lama satu", "Lama dua", "Lama tiga"],
      method: "native",
    });
    await repository.replaceExtractedText({ ...run, pages: ["Diganti"], method: "mixed" });

    expect(await pageText(run.versionId)).toEqual(["Diganti"]);
    expect(await pageCount(run.versionId)).toBe(1);
    const text = await db
      .select()
      .from(schema.documentText)
      .where(eq(schema.documentText.versionId, run.versionId));
    expect(text).toHaveLength(1);
    expect(text[0]).toMatchObject({ extractionMethod: "mixed", language: null, charCount: 7 });
  });

  test("AC-33.01: a newer version never overwrites the text of the version it supersedes", async () => {
    const repository = createExtractionRepository(db);
    const first = await seedVersion();
    await repository.replaceExtractedText({
      ...first,
      pages: ["Teks versi pertama"],
      method: "native",
    });
    const secondId = await insertVersion({ ...first, versionNumber: 2 });
    await db
      .update(schema.documents)
      .set({ currentVersionId: secondId })
      .where(eq(schema.documents.id, first.documentId));
    await repository.replaceExtractedText({
      tenantId: first.tenantId,
      documentId: first.documentId,
      versionId: secondId,
      pages: ["Teks versi kedua"],
      method: "native",
    });

    expect(await pageText(first.versionId)).toEqual(["Teks versi pertama"]);
    expect(await pageText(secondId)).toEqual(["Teks versi kedua"]);
    const firstRows = await db
      .select()
      .from(schema.documentPages)
      .where(
        and(
          eq(schema.documentPages.tenantId, first.tenantId),
          eq(schema.documentPages.versionId, first.versionId),
        ),
      );
    expect(firstRows).toHaveLength(1);
  });
});

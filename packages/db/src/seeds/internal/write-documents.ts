import { eq, sql } from "drizzle-orm";
import {
  documentClassification,
  documentMetadata,
  documentPages,
  documents,
  documentTags,
  documentText,
  documentVersions,
} from "../../schema/index.ts";
import type { SeedDocument } from "./dev-documents.ts";
import { seedContentHash, seedId } from "./seed-keys.ts";
import type { SeedTx } from "./seed-transaction.ts";

const DAY_MS = 86_400_000;

export type DocumentsSeed = {
  tenantId: string;
  tenantSubdomain: string;
  userIdByEmail: Map<string, string>;
  categoryIdByName: Map<string, string>;
  documents: SeedDocument[];
};

type Resolved = {
  seed: SeedDocument;
  documentId: string;
  uploaderId: string;
  createdAt: Date;
  /** Version ids in allocation order; the last one is current. */
  versionIds: string[];
};

function resolve(seed: DocumentsSeed, now: number): Resolved[] {
  return seed.documents.map((document) => {
    const uploaderId = seed.userIdByEmail.get(document.uploaderEmail);
    if (!uploaderId) throw new Error(`seed: uploader ${document.uploaderEmail} was not written`);
    const count = 1 + (document.extraVersions ?? 0);
    return {
      seed: document,
      documentId: seedId(`document:${seed.tenantSubdomain}:${document.key}`),
      uploaderId,
      createdAt: new Date(now - document.ageDays * DAY_MS),
      versionIds: Array.from({ length: count }, (_, index) =>
        seedId(`version:${seed.tenantSubdomain}:${document.key}:${index + 1}`),
      ),
    };
  });
}

/**
 * Documents and versions reference each other, so the write is ordered:
 * documents without a current version, then versions, then the back-fill.
 * `current_version_id` is left out of the conflict update so a rerun cannot
 * blank it between those steps.
 */
export async function writeDocuments(tx: SeedTx, seed: DocumentsSeed): Promise<void> {
  const resolved = resolve(seed, Date.now());

  await tx
    .insert(documents)
    .values(
      resolved.map((item) => ({
        id: item.documentId,
        tenantId: seed.tenantId,
        uploaderId: item.uploaderId,
        title: item.seed.title,
        processingState: item.seed.state,
        failureReason: item.seed.failureReason ?? null,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      })),
    )
    .onConflictDoUpdate({
      target: documents.id,
      set: {
        title: sql`excluded.title`,
        processingState: sql`excluded.processing_state`,
        failureReason: sql`excluded.failure_reason`,
        createdAt: sql`excluded.created_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await tx
    .insert(documentVersions)
    .values(
      resolved.flatMap((item) =>
        item.versionIds.map((versionId, index) => ({
          id: versionId,
          tenantId: seed.tenantId,
          documentId: item.documentId,
          versionNumber: index + 1,
          contentHash: seedContentHash(`${seed.tenantSubdomain}:${item.seed.key}:${index + 1}`),
          filename: item.seed.title,
          mimeType: item.seed.mimeType,
          sizeBytes: item.seed.sizeBytes,
          pageCount: item.seed.pages?.length ?? null,
          blobKey: `t/${seed.tenantId}/d/${item.documentId}/v/${versionId}`,
          uploadedBy: item.uploaderId,
          createdAt: item.createdAt,
        })),
      ),
    )
    .onConflictDoUpdate({
      target: documentVersions.id,
      set: {
        filename: sql`excluded.filename`,
        sizeBytes: sql`excluded.size_bytes`,
        pageCount: sql`excluded.page_count`,
        createdAt: sql`excluded.created_at`,
      },
    });

  for (const item of resolved) {
    const current = item.versionIds.at(-1);
    if (!current) continue;
    await tx
      .update(documents)
      .set({ currentVersionId: current })
      .where(eq(documents.id, item.documentId));
  }

  await writeEnrichment(tx, seed, resolved);
}

async function writeEnrichment(
  tx: SeedTx,
  seed: DocumentsSeed,
  resolved: Resolved[],
): Promise<void> {
  const enriched = resolved.filter((item) => item.seed.pages !== undefined);
  if (enriched.length === 0) return;

  const textRows = enriched.map((item) => {
    const pages = item.seed.pages ?? [];
    const currentVersion = item.versionIds.at(-1);
    if (!currentVersion) throw new Error(`seed: ${item.seed.key} has no version`);
    return {
      versionId: currentVersion,
      tenantId: seed.tenantId,
      extractionMethod: item.seed.extraction ?? ("native" as const),
      language: "ind",
      charCount: pages.reduce((total, page) => total + page.length, 0),
      extractedAt: item.createdAt,
      pages,
    };
  });

  await tx
    .insert(documentText)
    .values(textRows.map(({ pages: _pages, ...row }) => row))
    .onConflictDoUpdate({
      target: documentText.versionId,
      set: {
        extractionMethod: sql`excluded.extraction_method`,
        charCount: sql`excluded.char_count`,
        extractedAt: sql`excluded.extracted_at`,
      },
    });

  await tx
    .insert(documentPages)
    .values(
      textRows.flatMap((row) =>
        row.pages.map((content, index) => ({
          versionId: row.versionId,
          tenantId: seed.tenantId,
          pageNumber: index + 1,
          content,
        })),
      ),
    )
    .onConflictDoUpdate({
      target: [documentPages.versionId, documentPages.pageNumber],
      set: { content: sql`excluded.content` },
    });

  const classificationRows = enriched.flatMap((item) => {
    const categoryName = item.seed.category;
    if (!categoryName) return [];
    const categoryId = seed.categoryIdByName.get(categoryName);
    if (!categoryId) throw new Error(`seed: category ${categoryName} was not written`);
    return [
      {
        documentId: item.documentId,
        tenantId: seed.tenantId,
        categoryId,
        aiSuggestedCategoryId: categoryId,
        aiConfidence: item.seed.confidence ?? null,
        confirmedAt: item.seed.confirmed ? item.createdAt : null,
        confirmedBy: item.seed.confirmed ? item.uploaderId : null,
      },
    ];
  });

  if (classificationRows.length > 0) {
    await tx
      .insert(documentClassification)
      .values(classificationRows)
      .onConflictDoUpdate({
        target: documentClassification.documentId,
        set: {
          categoryId: sql`excluded.category_id`,
          aiSuggestedCategoryId: sql`excluded.ai_suggested_category_id`,
          aiConfidence: sql`excluded.ai_confidence`,
          confirmedAt: sql`excluded.confirmed_at`,
          confirmedBy: sql`excluded.confirmed_by`,
        },
      });
  }

  const tagRows = enriched.flatMap((item) =>
    (item.seed.tags ?? []).map((tag) => ({
      documentId: item.documentId,
      tenantId: seed.tenantId,
      tag,
      confidence: item.seed.confidence ?? null,
      source: "ai" as const,
    })),
  );

  if (tagRows.length > 0) {
    await tx
      .insert(documentTags)
      .values(tagRows)
      .onConflictDoUpdate({
        target: [documentTags.documentId, documentTags.tag],
        set: { confidence: sql`excluded.confidence`, source: sql`excluded.source` },
      });
  }

  await tx
    .insert(documentMetadata)
    .values(
      enriched.map((item) => ({
        documentId: item.documentId,
        tenantId: seed.tenantId,
        author: item.seed.author ?? null,
        documentCreatedAt: item.createdAt,
      })),
    )
    .onConflictDoUpdate({
      target: documentMetadata.documentId,
      set: { author: sql`excluded.author`, documentCreatedAt: sql`excluded.document_created_at` },
    });
}

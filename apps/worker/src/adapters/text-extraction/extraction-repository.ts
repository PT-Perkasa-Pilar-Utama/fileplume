import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { ExtractedDocument, ExtractionRepository } from "@archiva/enrichment";
import { and, eq } from "drizzle-orm";

/**
 * Drizzle adapter for immutable-version extracted text. It lives here, with the
 * worker that composes it, because @archiva/enrichment declares the port only.
 */
export function createExtractionRepository(db: Db): ExtractionRepository {
  return {
    async replaceExtractedText(input: ExtractedDocument): Promise<void> {
      const charCount = input.pages.reduce((count, page) => count + page.length, 0);
      await db.transaction(async (tx) => {
        const [version] = await tx
          .select({ id: schema.documentVersions.id })
          .from(schema.documentVersions)
          .where(
            and(
              eq(schema.documentVersions.tenantId, input.tenantId),
              eq(schema.documentVersions.documentId, input.documentId),
              eq(schema.documentVersions.id, input.versionId),
            ),
          )
          .for("update");
        if (!version) throw new Error("Extraction version does not belong to document and tenant");
        await tx
          .delete(schema.documentPages)
          .where(
            and(
              eq(schema.documentPages.tenantId, input.tenantId),
              eq(schema.documentPages.versionId, input.versionId),
            ),
          );
        await tx.insert(schema.documentPages).values(
          input.pages.map((content, index) => ({
            tenantId: input.tenantId,
            versionId: input.versionId,
            pageNumber: index + 1,
            content,
          })),
        );
        await tx
          .insert(schema.documentText)
          .values({
            tenantId: input.tenantId,
            versionId: input.versionId,
            extractionMethod: input.method,
            language: input.language ?? null,
            charCount,
            extractedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.documentText.versionId,
            set: {
              extractionMethod: input.method,
              language: input.language ?? null,
              charCount,
              extractedAt: new Date(),
            },
          });
        await tx
          .update(schema.documentVersions)
          .set({ pageCount: input.pages.length })
          .where(
            and(
              eq(schema.documentVersions.tenantId, input.tenantId),
              eq(schema.documentVersions.documentId, input.documentId),
              eq(schema.documentVersions.id, input.versionId),
            ),
          );
      });
    },
  };
}

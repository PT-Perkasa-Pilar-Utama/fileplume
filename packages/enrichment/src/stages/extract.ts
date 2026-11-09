import type { DocumentId, Result, TenantId, VersionId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type { TextExtractionFailure } from "../errors.ts";
import type { ExtractBlobStore, TextExtractor } from "../ports.ts";

export type ExtractStageParams = {
  tenantId: TenantId;
  documentId: DocumentId;
  versionId: VersionId;
  blobKey: string;
  mimeType: string;
  blobStore: ExtractBlobStore;
  extractor: TextExtractor;
  /** Persists document_text and ordered document_pages rows atomically. */
  persist(run: {
    tenantId: TenantId;
    documentId: DocumentId;
    versionId: VersionId;
    pages: string[];
    method: "native" | "ocr" | "mixed";
    language?: "ind" | "eng" | "mixed";
  }): Promise<void>;
};

export type ExtractStageError =
  | TextExtractionFailure
  | { kind: "ExtractionUnavailable"; cause: unknown };

/** Stage 2: persist each extracted page against its exact immutable version. */
export async function executeExtractStage(
  params: ExtractStageParams,
): Promise<Result<void, ExtractStageError>> {
  let stream: ReadableStream;
  try {
    stream = await params.blobStore.get(params.blobKey);
  } catch (cause: unknown) {
    return err({ kind: "ExtractionUnavailable", cause });
  }
  // Extraction is external work; no database transaction is open here.
  const extracted = await params.extractor.extract(stream, params.mimeType);
  if (!extracted.ok) return extracted;
  if (extracted.value.pages.length === 0) return err({ kind: "UnreadableContent" });
  try {
    await params.persist({
      tenantId: params.tenantId,
      documentId: params.documentId,
      versionId: params.versionId,
      pages: extracted.value.pages,
      method: extracted.value.method,
      ...(extracted.value.language !== undefined ? { language: extracted.value.language } : {}),
    });
  } catch (cause: unknown) {
    return err({ kind: "ExtractionUnavailable", cause });
  }
  return ok(undefined);
}

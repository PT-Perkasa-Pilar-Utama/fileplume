import type { DocumentId, Result, TenantId } from "@archiva/shared";
import { err } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { PageDocument, RawHit, SearchIndex } from "./ports.ts";

export const MIN_QUERY_LENGTH = 2;
export const RELATED_LIMIT = 5;

export type ContentHit = RawHit & { matchCount: number };

/** The index document id, which makes re-indexing a page idempotent. */
export function pageDocumentId(versionId: string, pageNumber: number): string {
  return `${versionId}:${pageNumber}`;
}

/** Refuses before touching OpenSearch. AC-07.03. */
export function isQueryLongEnough(q: string): boolean {
  return q.trim().length >= MIN_QUERY_LENGTH;
}

export function rejectShortQuery(q: string): Result<never, E.QueryTooShort> | null {
  return isQueryLongEnough(q) ? null : err({ kind: "QueryTooShort" });
}

/** A quoted query is an exact phrase, so hyphenated terms survive. AC-33.01. */
export function isExactPhrase(q: string): boolean {
  const trimmed = q.trim();
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"');
}

export interface SearchService {
  indexDocument(pages: PageDocument[]): Promise<void>;
  removeDocument(tenantId: TenantId, documentId: DocumentId): Promise<void>;
  searchTitles(
    tenantId: TenantId,
    q: string,
    page: { page: number; limit: number },
  ): Promise<Result<{ total: number; hits: RawHit[] }, E.QueryTooShort>>;
  searchContent(
    tenantId: TenantId,
    q: string,
    page: { page: number; limit: number },
  ): Promise<Result<{ total: number; hits: ContentHit[] }, E.QueryTooShort>>;
  findRelated(tenantId: TenantId, documentId: DocumentId, limit?: number): Promise<RawHit[]>;
  indexLagSeconds(): Promise<number>;
}

export function createSearchService(_deps: { index: SearchIndex }): SearchService {
  throw new Error("SCAFFOLD: implement in BE-S4-01 through BE-S4-04");
}

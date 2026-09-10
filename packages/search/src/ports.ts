export type PageDocument = {
  tenantId: string;
  documentId: string;
  versionId: string;
  pageNumber: number;
  title: string;
  content: string;
  categoryId: string | null;
  tags: string[];
};

export type RawHit = {
  documentId: string;
  title: string;
  pageNumber: number;
  fragment: string;
  score: number;
};

/**
 * The only place a query body is constructed. Callers pass a query string, so
 * a caller cannot build a query that omits the tenant filter. AC-43.02.
 */
export interface SearchIndex {
  bulkIndex(docs: PageDocument[]): Promise<void>;
  deleteByDocument(tenantId: string, documentId: string): Promise<void>;
  query(input: {
    tenantId: string;
    q: string;
    field: "title" | "content";
    from: number;
    size: number;
  }): Promise<{ total: number; hits: RawHit[] }>;
  moreLikeThis(tenantId: string, documentId: string, limit: number): Promise<RawHit[]>;
  lagSeconds(): Promise<number>;
}

# 13 — Search Indexing Strategy

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

How document text becomes searchable and how a query returns the page it matched on. Covers the index model, the analyzer chain for Indonesian and English, tenant filtering, highlight configuration, reindex and backfill, and index lag as a monitored signal. Applies to US-07, US-33 and US-08.

**This document is the single source of truth for search. Cite it, do not repeat it.** The index mapping, the analyzer chain and the tenant filter appear here and nowhere else.

The binding constraint: AC-33.01 requires a highlighted snippet **from page 15**, in under 3 seconds, over 100,000 documents per tenant averaging 50 pages. That is one index document per page, roughly 5,000,000 page documents per tenant.

## 13.1 Decision matrix

| Concern | Decision | Rationale |
|---|---|---|
| Index unit | One document per **page**, not per document | AC-33.01 needs the page number and a fragment from that page. A document-level index cannot say which page matched. |
| Engine | OpenSearch 2.x | The only self-hostable option that holds 5M page documents per tenant with native fragment highlighting. Apache 2.0 keeps roadmap US-31 open. |
| Index topology | One shared index per environment, tenant as a filtered field | 10 to 20 tenants. Index-per-tenant multiplies shard overhead for no isolation gain over a mandatory filter. |
| Tenant isolation | Mandatory `term` filter applied inside `packages/search`. Callers pass a query string, never a query body. | AC-43.02. A caller cannot construct a query that omits it. |
| Analyzer | ICU normalisation, lowercase, Indonesian stemmer, English stemmer, no stopword removal | Mixed-language corpus. Stopword removal would break exact-phrase criteria like "klausul-kerahasiaan". |
| Title vs content | Two fields, two queries. `searchTitles` hits title and metadata; `searchContent` hits content. | US-07 and US-33 are different criteria with different result shapes |
| Highlighting | `unified` highlighter, `fragment_size: 200`, `number_of_fragments: 1` | AC-33.01 wants one readable snippet, not a scatter of words |
| Exact phrase | Preserved via a `keyword` sub-field and quoted-phrase detection | "klausul-kerahasiaan" is a hyphenated exact term in the criterion |
| Refresh policy | `refresh: false` on bulk index, default 1 s interval | Bulk indexing 50 pages with `wait_for` multiplies write cost for a guarantee nothing needs |
| In-flight documents | Absent from content search until READY, and the caller says so | AC-33.03 |
| Reindex | Build into a new index, flip an alias | A reindex must never leave search partially empty |
| Deletion | Delete by query on `documentId` | A soft-deleted document must vanish from search immediately, though its row survives |
| Related documents | `more_like_this` on tags and category, tenant-filtered, limit 5 | US-08. Cheaper and more predictable than a vector index at this scale. |
| Vector search | Not in release 1 | No criterion asks for semantic search. Revisit when one does. |

## 13.2 Index model

Alias `archiva-pages`, backed by a concrete index `archiva-pages-000001`.

```json
{
  "settings": {
    "index": { "number_of_shards": 3, "number_of_replicas": 1, "refresh_interval": "1s" },
    "analysis": {
      "analyzer": {
        "archiva_text": {
          "type": "custom",
          "char_filter": ["icu_normalizer"],
          "tokenizer": "standard",
          "filter": ["lowercase", "indonesian_stemmer", "english_stemmer"]
        }
      },
      "filter": {
        "indonesian_stemmer": { "type": "stemmer", "language": "indonesian" },
        "english_stemmer": { "type": "stemmer", "language": "english" }
      }
    }
  },
  "mappings": {
    "properties": {
      "tenantId":    { "type": "keyword" },
      "documentId":  { "type": "keyword" },
      "versionId":   { "type": "keyword" },
      "pageNumber":  { "type": "integer" },
      "title":       { "type": "text", "analyzer": "archiva_text",
                       "fields": { "raw": { "type": "keyword" } } },
      "content":     { "type": "text", "analyzer": "archiva_text" },
      "categoryId":  { "type": "keyword" },
      "tags":        { "type": "keyword" },
      "author":      { "type": "text", "analyzer": "archiva_text" },
      "uploaderId":  { "type": "keyword" },
      "confirmedAt": { "type": "date" },
      "createdAt":   { "type": "date" },
      "indexedAt":   { "type": "date" }
    }
  }
}
```

The index document id is `versionId:pageNumber`, which makes bulk indexing idempotent: re-indexing a page overwrites rather than duplicating. That is what lets the pipeline retry the index stage safely (12.1).

`title` is denormalised onto every page document. It costs storage and removes a join from every content search, which is the right trade at a 3-second budget.

## 13.3 Interface

```ts
// packages/search/src/index.ts

export interface SearchService {
  /** Idempotent. Re-indexing the same version replaces its pages. */
  indexDocument(doc: IndexableDocument): Promise<void>;

  /** Removes every page of a document. Called on delete and on version replace. */
  removeDocument(tenantId: TenantId, documentId: DocumentId): Promise<void>;

  searchTitles(
    tenantId: TenantId, q: string, page: PageRequest,
  ): Promise<Result<Page<TitleHit>, QueryTooShort>>;

  searchContent(
    tenantId: TenantId, q: string, page: PageRequest,
  ): Promise<Result<Page<ContentHit>, QueryTooShort>>;

  findRelated(
    tenantId: TenantId, documentId: DocumentId, limit?: number,
  ): Promise<Hit[]>;

  reindexTenant(tenantId: TenantId): Promise<JobId>;

  /** Seconds between the newest indexed page and the newest READY document. */
  indexLagSeconds(): Promise<number>;
}

export interface ContentHit {
  documentId: DocumentId;
  title: string;
  pageNumber: number;        // AC-33.01: the page the match was on
  fragment: string;          // AC-33.01: highlighted, <em> around the match
  score: number;
}
```

Note what the signatures do not accept: a query body, an index name, a filter object. Callers pass a tenant, a string and a page. Everything else is this module's business, which is what makes AC-43.02 unfailable by a caller.

## 13.4 Query shape

Content search, the AC-33.01 path:

```json
{
  "query": {
    "bool": {
      "filter": [{ "term": { "tenantId": "<always injected>" } }],
      "must": [{ "match": { "content": { "query": "<user text>", "operator": "and" } } }]
    }
  },
  "highlight": {
    "type": "unified",
    "fields": { "content": { "fragment_size": 200, "number_of_fragments": 1 } }
  },
  "collapse": { "field": "documentId", "inner_hits": { "name": "best_page", "size": 1 } },
  "_source": ["documentId", "title", "pageNumber"]
}
```

`collapse` on `documentId` is what makes the result list read as documents while the index stores pages. Without it, a phrase appearing on six pages returns six rows for one document.

## 13.5 Performance targets

| Metric | Target | Source |
|---|---|---|
| Title search p95 | < 3 s | AC-07.01 |
| Content search p95 | < 3 s | AC-33.01 |
| Related documents p95 | < 1 s | Derived from AC-08.01 |
| Page documents per tenant | 5,000,000 | 08-nfr.md 8.1 |
| Concurrent searches | 20 | 08-nfr.md 8.3 |
| Bulk index, 50 pages | < 2 s | Derived from 12.5 |
| Index lag, steady state | < 5 s | 08-nfr.md 8.7 |
| Index lag alert | above 60 s for 5 min | 08-nfr.md 8.7 |
| Minimum query length | 2 characters | AC-07.03 |

Both 3-second budgets are measured at the full 8.1 volume under 8.3 concurrency. A benchmark against a synthetic 100,000-document corpus must run before US-33 is committed; this is the spike in `01-overview.md` 1.7 item 2.

## 13.6 Reindex and backfill

Alias flip, never an in-place rebuild:

1. Create `archiva-pages-00000N+1` from the current template.
2. Bulk index from `document_pages` in Postgres, which is the source of truth. The index is derived and disposable.
3. Verify the document count matches.
4. Flip the alias atomically.
5. Delete the old index after a soak.

Postgres holding the page text is what makes this safe. A search index that is the only copy of extracted text is a search index that cannot be rebuilt.

Triggers: mapping or analyzer change, OpenSearch major upgrade, corruption, or a tenant requesting a rebuild after a bulk correction.

## 13.7 Security constraints

1. The tenant filter is applied inside this module and cannot be omitted by a caller.
2. Search endpoints are rate limited at 60 per minute per session (07-security.md 7.4).
3. Queries under 2 characters are rejected before reaching OpenSearch, so a single character cannot scan the corpus.
4. OpenSearch is bound to the internal Docker network and never exposed publicly. Credentials come from `OPENSEARCH_USERNAME` and `OPENSEARCH_PASSWORD`.
5. `OPENSEARCH_INDEX_PREFIX` differs per environment, so SIT can never read production data.
6. Highlighted fragments are HTML-escaped before the `<em>` tags are applied, so document content cannot inject markup into the result list.

## 13.8 Component and contract

```
packages/search/
├── src/
│   ├── index.ts                 SearchService, the locked surface in 13.3
│   ├── ports.ts                 SearchIndex port
│   ├── mapping.ts               The index template in 13.2, version-controlled
│   ├── queries/
│   │   ├── title.ts
│   │   ├── content.ts
│   │   └── related.ts
│   ├── reindex.ts               Alias-flip procedure from 13.6
│   └── testing/
│       └── in-memory-index.ts   Enough behaviour to test filtering and highlighting
```

## 13.9 What this does NOT do

| Not here | Why | Where it actually lives |
|---|---|---|
| Extract text | Search receives text, it never produces it | `enrichment`, 12-document-processing-pipeline.md |
| Decide visibility of unconfirmed documents | A filter over a business rule search does not own | `classification.isVisibleToTenant`, grooming D4 |
| Enforce download permission | Search returns what exists; downloading it is a separate decision | `classification.canDownloadCategory` |
| Filter the document list by category | US-34 is a Postgres query on the list, not a search query | `catalog` |
| Filter a table by keyword | US-37 is client-side over an already-loaded page | `apps/web`, TanStack Table |
| Semantic or vector search | No criterion requires it | Not implemented, see 13.11 |
| Store the authoritative page text | The index is derived and disposable | `document_pages`, 06-data-model.md 6.8 |
| Search across tenants | There is no such operation, by construction | Not implemented |

## 13.10 Cross-references

| Concern | Source |
|---|---|
| Module surface and invariants | `05-module-definitions.md` 5.6 |
| Page storage | `06-data-model.md` 6.8 |
| Corpus size and latency budgets | `08-nfr.md` 8.1, 8.2 |
| Index stage in the pipeline | `12-document-processing-pipeline.md` 12.4 |
| Adapter, timeout, failure mode | `10-integration-points.md` 10.4 |
| Index environment variables | `11-environment-configuration.md` 11.2 |
| Tenant isolation across all stores | `07-security.md` 7.3 |

## 13.11 Open follow-ups

| Item | Trigger to revisit |
|---|---|
| Index per tenant | Above roughly 50 tenants, or when one tenant's volume distorts shard balance |
| Vector or hybrid search | When a criterion asks for meaning rather than words |
| Search-as-you-type suggestions | When a criterion asks for it. It needs a separate completion field. |
| Custom Indonesian synonyms | When zero-result rate stays above the 15% target in AC-12.02 despite correct indexing |
| Per-tenant analyzer overrides | When a tenant's corpus is dominated by a vocabulary the stemmer mangles |
| Cross-field ranking tuning | After the first real corpus benchmark, when relevance can be judged against actual documents |

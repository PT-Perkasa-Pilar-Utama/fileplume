# 08 — Search

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Queries against the index and the related-document lookup. Module: `search` ([../technical-specs/05-module-definitions.md 5.6](../technical-specs/05-module-definitions.md)). The module owns no tables; it owns the OpenSearch index and its mapping.

The index model, the analyzer chain, the tenant filter and the highlight configuration are specified once, in [../technical-specs/13-search-indexing-strategy.md](../technical-specs/13-search-indexing-strategy.md). This file cites them and does not restate them.

Conventions in [01-conventions.md](01-conventions.md) apply.

## 8.1 Rules that hold across every operation here

1. The tenant filter is applied inside the module. Callers pass a query string, never a query body. A caller cannot construct a query that omits the filter, which is what makes AC-43.02 and AC-08.04 true by construction rather than by review (module invariant 5.6.1).
2. Two characters minimum. A shorter query returns `QUERY_TOO_SHORT` without touching OpenSearch (AC-07.03, module invariant 5.6.3).
3. Indexing is asynchronous relative to upload. A document still processing is absent from content search, and the response says so (AC-33.03, module invariant 5.6.4).
4. The confirmation window applies to results. The predicate in [05-documents.md 5.4.1](05-documents.md) is applied to every hit, so a colleague's unconfirmed document does not surface in search (AC-02.05) and does surface once the window elapses (AC-02.06).
5. Every query writes a `search.performed` audit event carrying the result count, which is the source for the search volume and zero-result rate in AC-12.02. This action is an addition to the closed `audit_action` enum, flagged in [01-conventions.md 1.13](01-conventions.md). The query string itself is not stored; the metric needs counts, not a log of what people looked for.

Rate limit: 60 per minute per session ([01-conventions.md 1.10](01-conventions.md)).

Latency budget: results in under 3 seconds at 100,000 documents per tenant with 20 concurrent searches (AC-07.01, AC-33.01, [../technical-specs/08-nfr.md 8.2](../technical-specs/08-nfr.md)).

## 8.2 GET /search/titles

**Signature.** `GET /api/v1/search/titles`

**Purpose.** Search titles and metadata. The default search bar behaviour.

**Access.** `member`.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `q` | string | yes | 2 to 200 characters. Trimmed before the length check, so three spaces is too short. |
| `page` | integer | no | Default 1 |
| `limit` | integer | no | Default 10, max 100 |

**Behavior.**

1. Length check. Below two characters: `QUERY_TOO_SHORT`, and OpenSearch is not called (AC-07.03).
2. `search.searchTitles(tenantId, q, page)`. Hits `title` and `author`, using the `archiva_text` analyzer with its Indonesian and English stemmers and no stopword removal ([../technical-specs/13-search-indexing-strategy.md 13.1](../technical-specs/13-search-indexing-strategy.md)).
3. Deduplicate to one hit per document. The index is one document per page, so a title match would otherwise return the same document once per page.
4. Apply the confirmation-window predicate. When it removes every hit, the empty-state message is `Dokumen tidak ditemukan` rather than the general one, because AC-02.05 asserts that exact string.
5. Write the `search.performed` event.

**Output.** `200 OK`, collection envelope.

```json
{
  "data": [
    {
      "documentId": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
      "title": "kontrak-kerjasama.pdf",
      "fileType": "pdf",
      "fragment": "kontrak <em>kerjasama</em> antara PT Contoh Baru dan ...",
      "uploader": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" },
      "category": { "id": "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b", "name": "Technical Spec" },
      "createdAt": "2026-09-01T09:00:00.000Z",
      "score": 8.42
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

`fragment` carries `<em>` around the match. It is the only HTML the API emits and the client must render it as markup rather than text, so the client escapes everything else in the string first. AC-07.01 requires each item to show the filename and the matching snippet.

Empty result: `meta.message` is `Tidak ada hasil yang ditemukan` (AC-07.02, AC-43.02).

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `QUERY_TOO_SHORT` | 422 | `q` under 2 characters after trimming (AC-07.03) | `Masukkan minimal 2 karakter untuk mencari` |
| `VALIDATION_ERROR` | 422 | `q` missing, over 200 characters | Per field |
| `RATE_LIMITED` | 429 | More than 60 searches in a minute | Standard |
| `SERVICE_UNAVAILABLE` | 503 | OpenSearch unreachable | Standard |

**Traceability.** AC-07.01, AC-07.02, AC-07.03, AC-43.02, AC-02.05, AC-02.06.

## 8.3 GET /search/content

**Signature.** `GET /api/v1/search/content`

**Purpose.** Deep content search: find the page a phrase appears on and return the snippet from that page.

**Access.** `member`.

**Input.** Same parameters as 8.2, plus:

| field | type | required | notes |
|---|---|---|---|
| `categoryId` | uuid | no | Narrow to one category |
| `tags` | string, repeated | no | Conjunctive, as in [05-documents.md 5.4](05-documents.md) |

A quoted `q`, for example `"klausul-kerahasiaan"`, is treated as an exact phrase against the `keyword` sub-field. Hyphenated exact terms are preserved, which is what AC-33.01 depends on ([../technical-specs/13-search-indexing-strategy.md 13.1](../technical-specs/13-search-indexing-strategy.md)).

**Behavior.**

1. Length check as 8.2.
2. `search.searchContent(tenantId, q, page)`. Returns page number and a highlighted fragment per hit, using the `unified` highlighter with `fragment_size: 200` and `number_of_fragments: 1`.
3. Collapse to the best-scoring page per document, and report `matchCount` for the rest. AC-33.01 wants the page a match was on, not one row per matching page of a 50-page contract.
4. Apply the confirmation-window predicate.
5. If any document in the tenant is not READY, set `meta.notice` to `Sebagian dokumen masih diproses dan belum dapat dicari`. The notice accompanies results rather than replacing them (AC-33.03).
6. Write the `search.performed` event.

**Output.** `200 OK`.

```json
{
  "data": [
    {
      "documentId": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
      "title": "kontrak-kerjasama.pdf",
      "fileType": "pdf",
      "pageNumber": 15,
      "fragment": "... tunduk pada <em>klausul-kerahasiaan</em> sebagaimana diatur ...",
      "matchCount": 3,
      "uploader": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" },
      "score": 12.07
    }
  ],
  "meta": {
    "page": 1, "limit": 10, "total": 1, "totalPages": 1,
    "notice": "Sebagian dokumen masih diproses dan belum dapat dicari"
  }
}
```

| field | type | nullable | notes |
|---|---|---|---|
| `pageNumber` | integer | no | The page the match was on. AC-33.01 requires it, and it is why the index unit is a page. |
| `fragment` | string | no | Highlighted, `<em>` around the match |
| `matchCount` | integer | no | Pages in this document that matched, at least 1 |

`pageNumber` is what the viewer jumps to. Clicking a result opens `GET /documents/:id/preview` and scrolls to that page with the term highlighted (AC-33.02); the highlighting inside the viewer is client-side over the rendered PDF, and this field is the coordinate it needs.

A document whose extraction failed with `password_protected` never appears here, because it has no pages in the index. It is still returned by 8.2 if its title matches, and it is still downloadable (AC-44.04).

Empty result: `meta.message` is `Tidak ada hasil yang ditemukan`.

**Errors.** As 8.2.

**Traceability.** AC-33.01, AC-33.02, AC-33.03, AC-43.02, AC-44.04.

## 8.4 GET /documents/:id/related

**Signature.** `GET /api/v1/documents/{id}/related`

**Purpose.** The "Dokumen Terkait" section on the detail page.

**Access.** `member`, subject to the visibility predicate.

**Input.** Path parameter `id`. Query parameter `limit` (integer, optional, default 5, max 5).

The cap is 5 and not configurable upward. AC-08.01 says "maksimal 5 dokumen", and a parameter that could exceed it would let a client contradict the criterion.

**Behavior.**

1. Resolve the document. Unknown, other tenant, or window-hidden: `404`.
2. `search.findRelated(tenantId, documentId, 5)`. A `more_like_this` query over tags and category, tenant-filtered ([../technical-specs/13-search-indexing-strategy.md 13.1](../technical-specs/13-search-indexing-strategy.md)).
3. Exclude the document itself.
4. Apply the confirmation-window predicate, so a colleague's unconfirmed document is not surfaced sideways through this panel.
5. Documents from another tenant cannot appear: the filter is inside the module (AC-08.04).

This operation does not write a `search.performed` event. It is a page-load side effect rather than a search a person performed, and counting it would inflate the AC-12.02 search volume with automatic reads.

**Output.** `200 OK`.

```json
{
  "data": [
    {
      "documentId": "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
      "title": "technical-proposal-test.pdf",
      "fileType": "pdf",
      "uploader": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" },
      "sharedCategory": true,
      "sharedTags": ["legal"],
      "score": 4.11
    }
  ],
  "meta": { "total": 1 }
}
```

Each item carries the filename and the uploader name, the two columns AC-08.01 names. `sharedCategory` and `sharedTags` explain why the document is here, so the panel is inspectable rather than an oracle.

Empty result: `meta.message` is `Tidak ada dokumen terkait` (AC-08.02).

Clicking an item opens `GET /documents/:id` for that document (AC-08.03).

**Errors.**

| code | status | condition |
|---|---|---|
| `NOT_FOUND` | 404 | Unknown, other tenant, or window-hidden |
| `SERVICE_UNAVAILABLE` | 503 | OpenSearch unreachable |

**Traceability.** AC-08.01, AC-08.02, AC-08.03, AC-08.04.

## 8.5 Reindex has no endpoint

`search.reindexTenant` and `search.indexLagSeconds` are not exposed as operations.

Reindex is an operational action, run from the worker or by the reset-state job ([10-system.md 10.5](10-system.md)). Exposing it would put a full tenant reindex behind a role, and no criterion asks for it.

Index lag is reported by the health monitor instead, as `checks.opensearch.indexLagSeconds` ([10-system.md 10.3](10-system.md)), which is where the alerting in grooming D13 reads it.

## 8.6 Search error codes

| code | status | condition | message |
|---|---|---|---|
| `QUERY_TOO_SHORT` | 422 | Query under 2 characters | `Masukkan minimal 2 karakter untuk mencari` |

Standard codes are in [01-conventions.md 1.8](01-conventions.md).

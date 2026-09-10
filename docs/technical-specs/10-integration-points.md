# 10 — Integration Points

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Six external dependencies. Each sits behind a port declared by the module that needs it, with a production adapter and a test adapter (`03-repository-structure.md` 3.3). The rule from the grill: a port exists only where two adapters are genuinely justified. All six qualify, because all six must be absent in a unit test.

## 10.1 Summary

| System | Port | Owner module | Classification | Failure impact |
|---|---|---|---|---|
| S3 or MinIO | `BlobStore` | catalog | remote-but-owned | Upload and download stop |
| ClamAV | `MalwareScanner` | enrichment | local-substitutable | Processing halts, uploads queue |
| OpenSearch | `SearchIndex` | search | remote-but-owned | Search degraded, upload unaffected |
| Gotenberg | `DocumentConverter` | catalog | local-substitutable | Office preview only |
| AI provider | `AiProvider` | enrichment | true-external | Classification degraded |
| OCR service | `TextExtractor` | enrichment | true-external | Scanned PDFs degraded |

## 10.2 Object storage

**Contract.** S3 API: `putObject`, `getObject` as a stream, `deleteObject`, `deleteObjectsByPrefix`. Keys are `t/<tenant_id>/d/<document_id>/v/<version_id>`.

**Adapters.** `S3BlobStore` in production, targeting R2 or S3 in cloud and MinIO on-premises through the same SDK. `InMemoryBlobStore` in tests, shipped inside `packages/catalog/src/testing/`.

**Failure mode.** Write failure aborts the upload, releases the quota reservation, returns 503, and no document row is created. Read failure returns 503 on download and preview; metadata still lists.

**Fallback.** None. This is the system of record for the bytes.

**Consistency.** The blob is written before the document row is inserted, so a crash between the two leaves an orphan blob, never a row pointing at nothing. Orphans are swept nightly by matching blob keys against `document_versions`.

## 10.3 ClamAV

**Contract.** clamd over TCP, `INSTREAM`, returns clean or a signature name.

**Adapters.** `ClamAvScanner` in production. `AlwaysCleanScanner` and `AlwaysInfectedScanner` in tests, the second exercising AC-46.02 without an EICAR file on disk.

**Failure mode.** If clamd is unreachable the job **fails closed**: the document stays PROCESSING and retries. It is never marked READY unscanned, and never becomes visible to other users.

**Fallback.** None, deliberately. Failing open would make US-46 decorative.

**Signature freshness.** `freshclam` runs in the sidecar. `/health/ready` reports signature age; older than 48 hours reports degraded.

## 10.4 OpenSearch

**Contract.** Bulk index, search with highlight, delete by query, index template management. Full mapping in `13-search-indexing-strategy.md`.

**Adapters.** `OpenSearchIndex` in production. `InMemorySearchIndex` in tests, implementing enough of the contract that tenant filtering and page-level highlighting are testable without a container. Integration tests run against a real container via Testcontainers.

**Failure mode.** Search returns 503 with an Indonesian message; the document list and filters still work because they are Postgres queries. Indexing failure marks the document FAILED with `index_failed` and leaves it downloadable (AC-44.03).

**Fallback.** None for content search. Title search could fall back to a Postgres `ILIKE` scan; this is deliberately **not** implemented, because a silent fallback that quietly returns different results is worse than an honest error.

**Invalidation and reindex.** `reindexTenant` rebuilds into a new index and flips an alias, so a reindex never leaves search partially empty.

## 10.5 Gotenberg

**Contract.** `POST /forms/libreoffice/convert`, multipart in, PDF out.

**Adapters.** `GotenbergConverter` in production, `StubConverter` returning a fixture PDF in tests.

**Failure mode.** Office preview returns `PreviewUnavailable`, rendered as "Preview tidak tersedia untuk dokumen ini" (AC-09.03). Download is unaffected, and PDF preview never touches Gotenberg.

**Fallback.** Offer the download. A user who cannot preview a DOCX can still open it locally.

**Caching.** Converted PDFs are cached in the blob store under a derived key. Conversion happens once per version, not once per view.

## 10.6 AI provider

**Contract.** Chat completion with a structured output schema. Input: extracted text truncated to a token budget, plus the tenant's category list. Output parsed against a Zod schema: `{ categoryId, confidence, documentType, tags[], author?, documentDate? }`.

**Adapters.** `AnthropicProvider` in production, pinned to an exact model id. `DeterministicStubProvider` in tests, returning fixed answers per fixture so AC-06.01 is repeatable. A self-hosted adapter is the on-premises path under roadmap US-31.

**Failure mode.** Transient errors and rate limits retry three times with exponential backoff (AC-44.02). Exhausted: the document is FAILED with `ai_unavailable` and stays fully usable, searchable by title, previewable and downloadable. Only the classification is missing.

**Fallback.** The document lands in the reserved `Uncategorized` category and appears in the Head of Team review queue, which is the same path AC-06.03 already defines for content the model cannot place. A failure and an inconclusive answer converge on one user-visible outcome.

**Cost and rate control.** Text is truncated before sending. A per-tenant daily token budget is tracked, and exceeding it queues rather than drops. Prompts are versioned in the repository; a prompt change is a code change, because it invalidates the AC-12.03 accuracy baseline.

**Data boundary.** Document text leaves the tenant boundary. This is grooming D8, accepted on condition of the abstraction above. Which provider, and under what retention terms, is an open commercial question recorded in `01-overview.md` 1.7 item 4.

## 10.7 OCR service

**Contract.** Page image in, text plus per-page confidence out. Invoked only for pages with no usable native text layer, so a born-digital PDF never reaches it.

**Adapters.** Hosted document AI in production. `TesseractExtractor` with `ind` and `eng` traineddata for on-premises and integration tests. `FixtureExtractor` returning known text for unit tests.

**Failure mode.** Per page. Pages that extract are indexed; pages that fail are recorded with empty content and the document is READY with a partial-text note, unless every page fails, which is FAILED with `unreadable_content` (AC-44.05).

**Fallback.** Tesseract as a second attempt when the hosted service is unavailable. Lower accuracy beats no text, and `extraction_method` records which produced the result so quality can be attributed later.

**Language.** Indonesian and English only (`01-overview.md` 1.7 item 6).

## 10.8 Cross-cutting rules

1. **Timeouts everywhere.** No external call is unbounded. Blob 30 s, ClamAV 60 s, OpenSearch 5 s, Gotenberg 120 s, AI 60 s, OCR 180 s per page.
2. **Circuit breaker** on the AI and OCR ports. Ten consecutive failures opens it for five minutes; the queue holds work rather than burning retries.
3. **No external call inside a database transaction.** The transaction commits, then the call happens, then a second transaction records the result. A slow provider must never hold a Postgres lock.
4. **Every adapter emits an OpenTelemetry span** named for the dependency, so `/health/ready` latencies and the 8.7 thresholds come from real data.
5. **Every port is exercised by a contract test** run against both adapters, so the in-memory double cannot drift from the real one.

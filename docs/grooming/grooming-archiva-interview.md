# Grooming Interview: Archiva Release 1

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** In progress  
**Source:** `docs/us-ac/User-Stories-and-AC.md`  
**Companion:** `docs/grooming/grooming-archiva-backlog.md` (full question set)  

Running record of decisions taken during refinement. Each entry is the question, why it matters, and the decision.

---

## N: Negotiable

### D1. Release 1 scope

**Question:** What is in release 1, given that the backlog mixes a document management product with e-signature, a visual workflow designer, ERP integration, external repository federation, native apps, on-premises deployment, and physical archive circulation?

**Why it matters:** US-15 to US-32 are four or five separate products carrying one happy-path acceptance criterion each. Estimating them as peers of the core stories produces a meaningless number.

**Decision:** **DMS core only.** Release 1 is US-01 to US-14 and US-33 to US-42. US-15 to US-32 move to a later roadmap.

**Carve-out:** The multi-tenancy foundation from US-15 is pulled forward into release 1 as a foundation story. AC-14.02 already demands absolute tenant isolation, and a tenant identifier has to exist on every table from the first migration. Only the Super Admin tenant management UI is deferred.

**Consequences to apply:** US-15 through US-32 are marked as roadmap in the source document rather than deleted. Questions about e-signature scope, ERP contracts, marketplace review, app store cycles, and on-premises architecture are out of scope for this interview.

### D2. Upload flow: who assigns the category

**Question:** US-02 says a document lands as "Uncategorized" and the member picks a category manually. US-06 says the AI assigns it automatically at upload. Which happens?

**Why it matters:** This is the core flow of the product and the two stories cannot both be true. It also decides whether the "UPLOADED DOCUMENT" tray in US-02 exists at all, because under US-06 nothing would ever be uncategorised.

**Decision:** **AI proposes, human confirms.** The document lands with an AI-suggested category shown as a pending suggestion in the uploader's tray. Accepting is one click. Overriding uses the picker US-02 already describes.

**Consequences to apply:** US-02 and US-06 both survive but must be reworded to describe one flow, not two. A document has a confirmation state (suggested, confirmed) that no story currently models. The override path is now required, not optional, and it is the source of the accuracy metric.

### D3. Can the AI create categories

**Question:** AC-06.01 has the AI creating a new top-level category at upload. US-34 assumes a fixed set and US-14 attaches a download permission to each category. Can the AI create categories?

**Why it matters:** Every AI-created category is a permission row nobody has governed, and a model that emits "Reporting", "Report", and "Laporan" splits one real category into three, fragmenting the filter and the permission model. It also leaves the category list unbounded, so the US-34 filter has no fixed shape.

**Decision:** **Fixed list, administrator-managed.** The AI classifies into an existing taxonomy only. Anything it cannot place goes to "Uncategorized" and surfaces in an administrator review queue.

**Consequences to apply:** AC-06.01 must be rewritten; its "new category defaults to inactive for download" clause becomes unnecessary, since categories now only exist after an administrator creates them and sets the permission deliberately. A new taxonomy management story is required (category CRUD, owned by the same role that owns US-14). US-06 is no longer coupled to US-14 by runtime category creation, which removes a sequencing constraint.

### D4. Visibility of documents pending category confirmation

**Question:** AC-02.05 hides an uncategorised document from everyone except its uploader, including in search. Is that the intended rule?

**Why it matters:** It is a real access control rule with real cost (every list and search query needs an owner-or-confirmed predicate), and as written it creates a permanent hiding place: a document nobody confirms is a document nobody else can ever find, with no signal that it is stuck.

**Decision:** **Private to the uploader, then it surfaces.** A document pending confirmation is visible only to its uploader for a configurable window, defaulting to 7 days. After that it appears to the whole tenant as "Uncategorized" and enters the administrator review queue. Head of Team and Admin Tenant can see pending documents at any time.

**Consequences to apply:** AC-02.05 must be rewritten to state the window and the exemption for Head of Team and Admin Tenant. Two new criteria are needed: what a colleague sees after the window expires, and what an administrator sees in the review queue. The window is a tenant configuration value, which gives US-42's configuration screen a second real parameter beyond max file size.

---

## E: Estimable

### D5. Duplicate versus new version versus new document

**Question:** US-03 keys duplicate detection on content hash; US-21 keys versioning on filename. Four combinations exist and the stories describe two. How does the system tell them apart?

**Why it matters:** This is the most under-specified rule in the backlog and it sits on the main flow. On one reading of US-21, a second user uploading their own `laporan.pdf` silently buries a colleague's unrelated document as an old version, in the wrong category, owned by the wrong person.

**Decision:** **Content hash blocks, versioning is explicit.**

| Uploaded file | Existing document | Result |
|---|---|---|
| Same content hash | any filename, same tenant | Rejected as duplicate, with a link to the existing document |
| Different content, same filename | any | Treated as a new, separate document |
| Different content | via "Upload new version" on a named document | New version of that document |
| Different content, new filename | none matching | New document |

Filename alone never creates a version. Versioning requires the user to act on a specific document.

**Consequences to apply:** US-21's AC-21.01 is wrong as written and must be rewritten around the explicit action. US-03 needs its error message extended to link to the existing document, since telling a user "File ini sudah ada" without saying where is unhelpful. One accepted cost: a member cannot upload a renamed copy of a document that already exists in the tenant, because the hash matches. Flagged as acceptable; revisit if users hit it.

### D6. Version numbering

**Question:** US-21 assigns v1.0 then v1.1, with no rule for what causes a major increment.

**Why it matters:** With no rule for the major component, every document climbs to v1.47 and the version picker in AC-21.02 becomes unreadable.

**Decision:** **Simple incrementing counter: v1, v2, v3.** No major and minor distinction.

**Consequences to apply:** AC-21.01 and AC-21.02 must be reworded away from "v1.0", "v1.1" and "v1.2". Revisit only if an archival or contract requirement for major versions appears later.

### D7. Supported file types

**Question:** AC-01.03 rejects JPG, US-33 names PDF, DOCX, XLSX, TXT and scanned PDF, and no story states the definitive list.

**Why it matters:** Each format is a separate parser, preview path, and text extraction path. DOCX and XLSX preview require a server-side conversion service, not a library call.

**Decision:** **PDF (native and scanned), DOCX, XLSX, TXT.** Everything else is rejected, including images.

**Consequences to apply:** AC-01.03's JPG rejection stands and no longer contradicts anything, because the scanner capture path (US-23) is roadmap under D1. US-01 needs an explicit rejection criterion naming the accepted list. US-09 preview must state that PDF renders natively while DOCX, XLSX and TXT render through server-side conversion, which is a service dependency the estimate has to carry.

### D8. Where AI processing happens

**Question:** US-04, US-05, US-06, US-25 and US-33 send document content to a model. The corpus is contracts, invoices, offering letters and financial reports. Hosted inference or self-hosted?

**Why it matters:** It is a confidentiality and data residency decision belonging to the customer, and it is the main recurring cost of running the product.

**Decision:** **Hosted inference provider for release 1, behind a provider abstraction.** On-premises is roadmap under D1, so nothing in release 1 forbids hosted inference.

**Consequences to apply:** The abstraction is a required design constraint on the ingestion pipeline story, not an optional refinement, because US-31 on the roadmap will need a self-hostable path. Two items now need a commercial answer before the first customer signs: which provider sees tenant documents, and under what retention terms. Neither blocks engineering. Per-document inference cost becomes a real unit cost and should be tracked against the storage quota work in US-35.

### D9. Search corpus size behind the 3 second promise

**Question:** AC-07.01 and AC-33.01 both require results in under 3 seconds, with no stated corpus size, document size, or concurrency.

**Why it matters:** Deep content search over OCR text is the main scaling risk in the product, and the choice between database full text search and a dedicated search index hangs entirely on this number. That choice is expensive to reverse.

**Decision:** **Approximately 100,000 documents per tenant** at 12 months. Working assumptions for the estimate: 50 pages average per document, 20 concurrent searches at peak.

**Consequences to apply:** Release 1 uses a dedicated search index, not database full text search. That adds a service to run, an index synchronisation path, and index lag as a monitored failure mode. AC-07.01 and AC-33.01 must state the corpus size and concurrency the 3 second target is measured against, otherwise neither is testable. A performance spike against a synthetic 100,000 document corpus should run before US-33 is committed.

### D10. Role model

**Question:** Four roles appear across the stories with no statement of how they relate. Are they nested or independent permission sets, and can one user hold more than one?

**Why it matters:** Nested versus disjoint changes every authorisation check in the system, and multiple roles per user changes the session model.

**Decision:** **Nested, one role per user per tenant.** Member Team is the base. Head of Team adds permission control and audit. Admin Tenant adds everything above it. Super Admin operates outside tenants and only creates and manages them.

**Consequences to apply:** US-41's criteria should describe a floor rather than enumerate per role, so adding a menu later does not require editing three criteria. US-41 has no criterion for Super Admin navigation and needs one, because a Super Admin has to exist in release 1 to create the first tenant. US-41 also lists a "Retention Policy" menu for Admin Tenant, but US-26 is roadmap under D1, so that menu entry must come out of release 1 scope.

---

## T: Testable

### D11. Malware scanning

**Question:** Nothing in the backlog scans uploaded files. Archiva accepts arbitrary files and serves them back to colleagues for preview and download.

**Why it matters:** Without scanning the product distributes whatever it is given, from the first day of production use, and retrofitting it means scanning the entire existing archive retrospectively.

**Decision:** **Scan on upload, in release 1.** Infected files are rejected with a clear message and an audit record.

**Consequences to apply:** A new required upload story. The marginal cost is low because the ingestion pipeline already needs a state where a file is stored but not yet released to the tenant, for AI processing. US-01 needs a rejection criterion for an infected file.

---

## V: Valuable

### D12. Correcting AI output

**Question:** D2 makes categories correctable, but AI-produced tags (US-05) and extracted invoice fields (US-25) have no correction path anywhere in the backlog.

**Why it matters:** A wrong extracted total on an invoice is a number someone will trust and act on. The correction path is also the only source of accuracy data.

**Decision:** **The document owner or Head of Team and above can edit any AI-produced field, and every override is recorded** with actor, timestamp, and the original AI value.

**Consequences to apply:** A new story covering override of category, tags, and extracted fields. Override rate per field becomes the accuracy metric, which answers the question no story currently answers: is the AI good enough to ship. US-05 and US-25 each need a criterion for the corrected state. The stored original value also gives support a way to explain a disputed figure.

### D13. What happens when processing fails

**Question:** AI extraction, OCR and indexing all run after the upload completes, and no criterion says what a user sees when any of them fails.

**Why it matters:** As written, a document whose processing fails simply never appears, with nothing on screen to explain why. Every such case becomes a support ticket that support cannot answer.

**Decision:** **Visible per-document status, automatic retry, then flagged.** States are queued, processing, ready, and failed with a reason. Transient failures retry automatically with backoff. A document that ends in failed remains in the list, previewable and downloadable, showing why the AI step did not complete.

**Consequences to apply:** Processing state is a field on the document that no story currently models, and it also carries the D11 scanning state and the D4 pending-confirmation state. New criteria required for OCR failure, extraction timeout, corrupt file, and password-protected PDF. Operational alerting on queue depth, failure rate, and index lag joins the definition of done for the ingestion pipeline.

### D14. Server-side authorisation

**Question:** AC-10.02 asserts only that the Download button is disabled, and US-41 asserts only that menus are hidden. Neither prevents a direct request to the endpoint.

**Why it matters:** As written, both criteria pass on a system that any logged-in member can exploit by opening developer tools. US-14 is a security story whose acceptance criteria do not test security.

**Decision:** **Enforce server-side, with an automated test on every role-gated route.** A denied request returns 403 and writes an audit record. Tenant isolation is tested by requesting another tenant's document by direct identifier, not only through search.

**Consequences to apply:** AC-10.02 and all three US-41 criteria need a server-side assertion added alongside the UI assertion. AC-14.02 must add a direct identifier access case; searching for "rahasia-b" proves almost nothing. Authorisation tests join the definition of done for every role-gated route.

### D15. Interface language

**Question:** Interface strings across the criteria mix Indonesian and English, so QA has no source of truth for what to assert.

**Why it matters:** Either the product is bilingual, in which case internationalisation is an unwritten story affecting every screen, or the strings are simply inconsistent.

**Decision:** **Indonesian only for release 1.** Every string in the acceptance criteria is normalised to Indonesian.

**Consequences to apply:** Strings to rewrite: "Document not found" in AC-02.05, "Showing 1 - 10 of 123 records" in AC-39.01, "Success adding new configuration" in AC-42.03, and the English field and button labels in AC-26.02 and AC-42.01. If English is required later it becomes an explicit internationalisation story, and criteria then assert on message keys rather than literal text.

### D16. Configuration screen (US-42)

**Question:** US-42's title is about capping upload size, but its criteria only describe a free-text Parameter Type and Parameter Value table, and nothing tests that the configured limit blocks an oversized upload.

**Why it matters:** An untyped configuration store has no validation. A misspelled parameter name is silently ignored, so the administrator believes the limit is set while uploads keep succeeding.

**Decision:** **Known parameters, typed and validated.** The screen lists a fixed set of settings the system actually reads. Administrators edit values, not names. Release 1 parameters:

| Parameter | Type | Default | Source |
|---|---|---|---|
| Max file size | size in MB | 20 | US-42, AC-42.03 |
| Pending confirmation window | days | 7 | D4 |
| Storage quota | size in GB | per tenant, set by Super Admin | US-35, D10 |

**Consequences to apply:** AC-42.01 to AC-42.04 must be rewritten around a fixed parameter list rather than free-text rows. US-42 splits: enforcement of the limit belongs on US-01 as a rejection criterion, the screen is the remainder. Storage quota is a per-tenant value set by a Super Admin, since US-16 tiering is roadmap under D1, which unblocks US-35.

### D17. What the analytics dashboard measures

**Question:** US-12 exists to prove team adoption, but its criterion counts only total documents and uploads in the last 7 days.

**Why it matters:** Upload count measures ingestion, not adoption. A team can upload a thousand documents and never find one.

**Decision:** **Keep the two counters and add retrieval and AI quality metrics:** searches performed, searches returning zero results, documents opened, and AI override rate from D12.

**Consequences to apply:** Analytics events are required and nothing currently emits them, so event emission joins the definition of done. Zero-result search rate is the cheapest early warning that classification or indexing is failing. Override rate is the in-product answer to whether the AI is good enough to keep.

---

## Definition of Ready verdict

### INVEST scorecard, after these decisions and assuming the refine step lands

| Lens | Verdict | Note |
|---|---|---|
| **I** ndependent | PASS | Release 1 is bounded (D1). Foundations are named and sequenced: tenancy, document and version schema, ingestion pipeline, taxonomy, scanning. D3 removed the runtime coupling between US-06 and US-14. |
| **N** egotiable | PASS | The US-02 versus US-06 contradiction is resolved (D2), the taxonomy is governed (D3), and roadmap items no longer compete with core work. |
| **V** aluable | PASS | Override rate gives a real accuracy measure (D12), analytics prove retrieval and not just ingestion (D17), and processing state plus alerting make failures operable (D13). |
| **E** stimable | WARN | Corpus size (D9) is an assumption, not a measurement, and AI accuracy on the customer's real documents is still unknown. Two spikes should run before US-06, US-25 and US-33 are committed. |
| **S** mall | WARN | Release 1 is still roughly 24 stories plus five foundation stories. US-42 splits under D16. Sprint allocation is a separate exercise. |
| **T** estable | WARN | Blocked on the refine step: the AC misalignment from US-09 onward must be fixed and the new criteria written before the story set is testable. |

### Ready for estimation

**Ready once the refine step lands.** The blocker is mechanical rather than open: the acceptance criteria from US-09 onward are attached to the wrong stories, and until that is corrected any estimate is attached to the wrong work. Every product question that was open at the start of this interview is now answered.

Two spikes to run before committing numbers on the AI stories:

1. Classification and extraction accuracy against a labelled sample of the customer's real documents. Decides whether US-06 and US-25 are viable as specified.
2. Deep content search latency against a synthetic 100,000 document corpus, per D9. Decides whether the 3 second promise in AC-07.01 and AC-33.01 holds.

### New stories the decisions require

| Story | Driven by | Why it cannot be folded into an existing story |
|---|---|---|
| Tenancy foundation | D1, D10 | A tenant identifier must exist on every table from the first migration; AC-14.02 already demands isolation. |
| Document and version schema | D5, D6 | One logical document with many versions, from the first migration, or every document needs backfilling. |
| Ingestion pipeline with processing state | D8, D13 | Single shared spine under US-04, US-05, US-06, US-25 and US-33, carrying scanning, confirmation and processing states. |
| Category taxonomy management | D3 | The AI classifies into an administrator-managed list that no story currently creates. |
| Malware scanning on upload | D11 | Required before any file is served back to a colleague. |
| AI output override | D12 | Correction path for tags and extracted fields, and the source of the accuracy metric. |

### Definition of done, assembled from the decisions

- Unit and integration tests for new logic, and an automated end-to-end test per acceptance criterion on the main flows.
- A server-side authorisation test on every role-gated route, asserting 403 and an audit record (D14).
- Tenant isolation tested by direct identifier access, not only through search (D14).
- Processing state visible in the UI, with alerting on queue depth, failure rate, and index lag (D13).
- Analytics events emitted for the metrics in D17.
- All interface strings in Indonesian (D15).

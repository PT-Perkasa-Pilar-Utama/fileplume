# Grooming: Archiva Backlog (US-01 to US-42)

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** For refinement meeting  
**Source:** `docs/us-ac/User-Stories-and-AC.md`  

## How to use this document

Every item is a question for the BA/PO, the reason it threatens the estimate, and the answer engineering would ship if forced to decide today. Confirm or override the recommendation; the meeting is a review, not a blank interrogation.

The repository currently holds documentation only. There is no code, schema, ADR, or technical specification to check these stories against, so every question about existing behaviour is genuinely open.

---

## Section 0: Blocker before any estimation, document integrity

The acceptance criteria blocks are systematically attached to the wrong stories from US-09 onward. Each AC block appears immediately **before** its `## US-NN` heading instead of after it, which shifts the whole second half of the document by one story. This is why four stories read as having no acceptance criteria: their AC is sitting under the previous story.

| Story | AC block currently attached to it | Where that content belongs |
|---|---|---|
| US-09 Melihat Preview Dokumen | `AC-08.01` | Content is correct for US-09, but the ID collides with US-08. Renumber to `AC-09.01`. |
| US-10 Mengunduh Dokumen | third block, `AC-10.01` "Mengunduh dokumen secara massal" | US-11 (bulk download) |
| US-11 Mengunduh Dokumen Massal | `AC-11.01` "Melihat metrik total dokumen" | US-12 (analytics dashboard) |
| US-12 Melihat Dasbor Analitik | none | receives the block above |
| US-14 Mengatur Perizinan Dokumen | second `AC-14.01` "Menambahkan tenant baru", `AC-14.02` "isolasi data antar tenant" | US-15 (tenant management) |
| US-15 Mengelola Tenant | `AC-15.01`, `AC-15.02` (tiering, feature visibility) | US-16 |
| US-16 Tiering SaaS | `AC-16.01` (create signature task) | US-17 |
| US-17 Task Penandatanganan | `AC-17.01` (monitor progress) | US-18 |
| US-18 Progress Penandatanganan | `AC-18.01` (deadline and overdue alert) | US-19 |
| US-19 Deadline dan Notifikasi | `AC-19.01` (role mapping) | US-20 |
| US-20 Role Mapping | none | receives the block above |
| US-21 Versioning | third block, `AC-21.01` (metadata view) | US-22 |
| US-22 Metadata View | `AC-22.01` (capture from email) | US-23 |
| US-23 Multi-Source Capture | `AC-23.01` (Outlook plugin) | US-24 |
| US-24 Plugin Email/Office | none | receives the block above |
| US-26 Retensi Dokumen | fourth block, `AC-26.01` (visual workflow builder) | US-27 |
| US-27 Alur Approval Visual | `AC-27.01` (peminjaman arsip fisik) | US-28 |
| US-28 Peminjaman Arsip Fisik | `AC-28.01` (Google Drive) | US-29 |
| US-29 Repositori Eksternal | `AC-29.01` (mobile app) | US-30 |
| US-30 Desktop dan Mobile | `AC-30.01` (on-premises deployment) | US-31 |
| US-31 On-Premises | `AC-31.01` (ERP integration) | US-32 |
| US-32 Integrasi ERP/CRM | none | receives the block above |
| US-38 Tampilan Kartu Visual | `AC-37.01`, `AC-37.02` | Content is correct for US-38, IDs collide with US-37. Renumber to `AC-38.01`, `AC-38.02`. |
| US-42 Batas Ukuran Dokumen | `AC-42-04` | Separator should be a dot: `AC-42.04`. |

Duplicate IDs in the current file: `AC-10.01` twice, `AC-14.01` twice, `AC-21.01` twice, `AC-26.01` twice.

**Q0.1** Can the BA regenerate the document with the AC blocks correctly nested and the IDs deduplicated before the meeting?
**Why it matters:** Nobody can estimate a story whose acceptance criteria belong to a different story, and no test case can cite an ID that appears twice. Every question below assumes the corrected mapping in the table.
**Recommendation:** Regenerate from the source before the session. If that is not possible, ratify the table above as the authoritative mapping and treat it as the working document. Estimating against the current file will produce numbers attached to the wrong stories.

**Q0.2** After realignment, US-11 through US-32 each carry exactly **one** acceptance criterion, and every one of them is a happy path. Is that the intended level of detail, or was the AC set truncated during authoring?
**Why it matters:** One happy-path scenario for a story like "multi-tenant management with absolute data isolation" or "visual approval workflow designer" is not enough to size, build, or test. It reads as a placeholder.
**Recommendation:** Treat US-01 to US-10 and US-33 to US-42 as candidates for estimation now, and US-11 to US-32 as not yet refined. Ask the BA to expand the second group before those stories enter a sprint.

---

## I: Independent

**Q1.1** The AI ingestion pipeline is a single dependency spine under US-04 (metadata), US-05 (auto tags), US-06 (auto category and document type), US-25 (field extraction), and US-33 (OCR for scanned PDF). Is that one service, built once, or five separate implementations?
**Why it matters:** If it is one service, no AI-facing story can ship until it exists, and five stories share one critical path. If it is five, the cost multiplies and the extraction results will disagree with each other.
**Recommendation:** One ingestion pipeline story delivered first, producing a single structured result per document (text layer, metadata, category, type, tags, extracted fields). US-04, US-05, US-06, US-25 and US-33 then become presentation and filtering stories on top of it. The alternative, per-feature extraction calls, means re-reading and re-billing every document once per feature.

**Q1.2** Multi-tenancy (US-15) sits at position 15 in the backlog, but AC-14.02 demands absolute data isolation between tenants. Is tenancy a foundational constraint from sprint 1, or a later addition?
**Why it matters:** A tenant identifier must exist on every table and every query from the first migration. Retrofitting tenancy after twenty stories means re-migrating every table and re-auditing every query, and any data written before the retrofit has no tenant.
**Recommendation:** Land the tenancy foundation (tenant column, request-scoped tenant resolution, enforcement at the data access layer) before US-01, even if the Super Admin tenant management UI ships much later. Confirm the isolation model: shared schema with a tenant discriminator is the default; schema-per-tenant or database-per-tenant costs materially more but may be required by the same customers who are asking for US-31.

**Q1.3** US-31 (on-premises and hybrid deployment) constrains every architectural choice made in every other story. Is on-premises in scope for the first release, or a later phase?
**Why it matters:** If on-premises is in scope, a managed cloud AI service, a managed search cluster, and cloud object storage may all be unavailable for those customers, and every dependency needs a self-hostable equivalent. Deciding this after the cloud version is built means building the platform twice.
**Recommendation:** Declare cloud-only for release 1 and defer US-31, but require that every infrastructure dependency chosen now has a self-hostable equivalent (object storage, search, OCR, model inference). If on-premises must be in scope now, that decision belongs in an ADR before any story is estimated.

**Q1.4** US-42 makes the maximum upload size a tenant configuration value, but US-01 (upload) and US-35 (quota) both need that limit to enforce anything. Which lands first?
**Why it matters:** US-01 has no acceptance criterion for an oversized file. Without the limit, the upload endpoint accepts a file of any size.
**Recommendation:** Ship a hard-coded system maximum with US-01, and make it tenant-overridable in US-42. Add a rejection AC to US-01 now rather than waiting for US-42.

**Q1.5** AC-06.01 states that a newly auto-created category defaults to inactive for download permission, which couples US-06 to US-14. Which sprint owns that coupling?
**Why it matters:** US-06 cannot be demoed as done without the permission model from US-14 existing, and US-14 cannot enumerate categories if US-06 creates them at runtime.
**Recommendation:** Land the category and permission model (US-14) before AI auto-categorisation (US-06), so that AI writes into an existing governed structure rather than creating ungoverned rows.

**Q1.6** US-23, US-24, US-29, US-30 and US-32 each depend on an external platform: mail servers and scanner hardware, the Microsoft and Google add-in marketplaces, SharePoint and Google Drive APIs, the Apple and Google app stores, and SAP, Oracle or Odoo instances. Which of those contracts and credentials do we have access to today?
**Why it matters:** Marketplace review for an Outlook or Gmail add-in and app store review both take weeks of calendar time that no sprint estimate absorbs. An ERP integration cannot be built without a customer sandbox.
**Recommendation:** Move all five out of the near-term backlog. For each, create a preceding spike story whose only output is confirmed credentials, a sandbox, and a documented API contract. Do not put a number on the integration itself until its spike closes.

**Q1.7** US-21 (versioning) changes the shape of a document record: one logical document with many versions, not one row per file. Does it land before or after US-01?
**Why it matters:** If versioning arrives later, every document uploaded before it has to be backfilled into a version structure, and the document list, preview, download and search all change their join.
**Recommendation:** Model documents as document plus version from the first migration even if the version picker UI ships in a later sprint. The schema cost now is small; the backfill cost later is not.

**Q1.8** Are feature flags available, given that US-16 requires per-tenant module toggling in real time?
**Why it matters:** US-16 is not just a billing screen. It is a runtime authorisation mechanism that every module must consult, on both the navigation and the API.
**Recommendation:** Build the flag evaluation mechanism alongside the tenancy foundation and have every module gate on it from the start. Retrofitting flags into finished modules touches every route.

---

## N: Negotiable

**Q2.1** US-02 and US-06 describe two incompatible upload behaviours. US-02 says the document lands as "Uncategorized" and the member picks a category manually. US-06 says the AI assigns the category automatically at upload and can create a new one. Which is the actual behaviour?
**Why it matters:** This is the core flow of the product and the two stories cannot both be true. It also decides whether the "UPLOADED DOCUMENT" tray in US-02 exists at all, because under US-06 nothing would ever be uncategorised.
**Recommendation:** AI proposes, the human confirms. The document lands with an AI-suggested category shown as a pending suggestion in the uploader's tray; accepting it is one click, and overriding it uses the same picker US-02 describes. This preserves both stories and produces the correction signal needed to measure AI accuracy. The alternative, fully automatic assignment, means a wrong category is invisible until someone cannot find the document.

**Q2.2** AC-06.01 has the AI creating new top-level categories at runtime ("Kategori 'Reporting' muncul di menu kategori utama"), while US-34 lists a fixed set (Proposal, Technical Spec, Contract Agreement, Financial) and US-14 has an administrator toggling download permission per category. Can the AI create categories?
**Why it matters:** Every AI-created category is a new permission row nobody has governed, and a model that invents "Reporting", "Report", and "Laporan" fragments both the filter and the permission model. It also means the category list is unbounded and the US-34 filter UI has no fixed shape.
**Recommendation:** The AI classifies into an administrator-managed taxonomy only. Anything it cannot place goes to "Uncategorized" with a suggestion queued for an administrator. Taxonomy management becomes a small new story. Free-form category creation should be rejected on governance grounds, not just cost.

**Q2.3** AC-02.05 makes an uncategorised document invisible to every user except its uploader, including through search. Is that a deliberate visibility rule?
**Why it matters:** It is a real access control rule with real cost (every list and search query needs an owner-or-categorised predicate), and it conflicts with US-06, where documents are categorised on arrival. It also creates a permanent hiding place: a document nobody categorises is a document nobody else can ever find.
**Recommendation:** Keep the rule as a staging concept but bound it. Uncategorised documents are visible only to the uploader for a configurable window, after which they surface to the tenant as "Uncategorized" and appear in an administrator's review queue. Confirm whether Head of Team and Admin Tenant are exempt from the rule.

**Q2.4** US-17 to US-20 describe an e-signature module. Is this legally binding electronic signature under Indonesian UU ITE with a certified provider (PSrE), or an internal approval flow that stamps a signature image?
**Why it matters:** This is the single largest cost fork in the backlog. Certified signing means integrating a licensed provider, certificate handling, timestamping, long-term validation, and a compliance review. An internal approval stamp is ordinary application work. The stories as written do not distinguish them.
**Recommendation:** Assume internal approval workflow with a tamper-evident audit trail for release 1, and treat certified signing as a separate epic with its own compliance track. If the customer needs legal validity, that changes the estimate by an order of magnitude and needs to be said now.

**Q2.5** US-17 (tiered signer mapping, levels 1 to 3), US-20 (dynamic signature role mapping), and US-27 (visual drag-and-drop workflow designer with branching conditions) are three ways to configure the same approval flow. Do all three ship?
**Why it matters:** US-27 subsumes US-17 and US-20. Building all three means three configuration surfaces writing to whatever model the workflow engine uses, and two of them become legacy on the day the third ships.
**Recommendation:** Ship US-17 (fixed three-level mapping) for release 1 and defer US-27 entirely. A visual workflow designer with conditional branching is a product in its own right, not a story. If US-27 is genuinely required, drop US-17 and US-20 and size US-27 as an epic.

**Q2.6** US-13 audits downloads only. Are views, previews, deletions, permission changes, retention destructions, and failed access attempts audited?
**Why it matters:** US-26 (retention) and US-14 (permission control) are both compliance features. A compliance story whose audit trail covers only downloads will not survive an audit, and adding event types later leaves the log with a gap for every event before the change.
**Recommendation:** Log a generic auditable event from day one (actor, action, subject, timestamp, tenant, outcome) and let US-13 render only the download view. Additional event types then cost a filter, not a migration.

**Q2.7** Is Archiva a document management system that also has e-signature, workflow design, physical archive circulation, ERP integration, native desktop and mobile apps, and on-premises deployment? Or is release 1 the DMS core?
**Why it matters:** US-01 to US-14 and US-33 to US-42 describe a coherent, shippable product. US-15 to US-32 describe four or five additional products. Estimating them as peers of each other produces a meaningless number.
**Recommendation:** Split the backlog explicitly into release 1 (DMS core: capture, classify, find, preview, download, govern, administer) and a later roadmap. Say so in the sprint breakdown rather than leaving it implied by ordering.

---

## V: Valuable

**Q3.1** What accuracy makes the AI classification (US-06), tagging (US-05), and field extraction (US-25) worth shipping, and how will we measure it?
**Why it matters:** These are the stories that justify the product, and they are the only ones whose output can be wrong without failing. A classifier at 60 percent accuracy is worse than no classifier, because users stop trusting the category and go back to searching by filename. Without a target, there is no definition of done.
**Recommendation:** Set a measurable bar per feature before build, for example 85 percent top-1 category accuracy and 90 percent field-level accuracy on invoices, measured against a labelled sample of the customer's real documents. Run the measurement as a spike before committing to US-06 and US-25. Without a labelled sample, we are estimating an unknown.

**Q3.2** No story lets a user correct the AI. If US-06 assigns the wrong category, US-05 assigns an irrelevant tag, or US-25 extracts the wrong invoice total, what happens?
**Why it matters:** A wrong extracted value on a financial document that a user believes is authoritative is a business risk, not a UI defect. The correction path is also the only source of accuracy data.
**Recommendation:** Add an override story. Any AI-produced field (category, type, tags, extracted fields) is editable by the owner or an administrator, the override is recorded with actor and timestamp, and overrides feed the accuracy metric in Q3.1. This is a required story, not an enhancement.

**Q3.3** US-12 measures total documents and uploads in the last seven days. Does that prove the value stated in the story ("adopsi tim terhadap sistem terpahami")?
**Why it matters:** Upload count measures ingestion, not adoption. A team can upload a thousand documents and never find one.
**Recommendation:** Add search and retrieval metrics to US-12: searches performed, searches returning zero results, documents opened, and AI category overrides. Zero-result searches in particular are the cheapest signal that classification or indexing is failing.

**Q3.4** What must exist for support to operate this in production: which failures raise an alert, and who sees them?
**Why it matters:** The failure modes here are asynchronous and silent. OCR failing on a scanned PDF, extraction timing out, or the index falling behind all present to the user as "my document is not there", with nothing in the UI to explain why.
**Recommendation:** Require per-document processing state (queued, processing, succeeded, failed, with a reason) visible in the UI, plus alerting on queue depth, processing failure rate, and index lag. Attach this to the definition of done for the ingestion pipeline story rather than raising it as a separate story.

---

## E: Estimable

**Q4.1** What is the exact list of supported file types? AC-01.03 rejects JPG, but US-23 captures documents from a scanner, which produces images, and US-33 requires search inside scanned PDF.
**Why it matters:** Each format is a separate parser, a separate preview path, and a separate text extraction path. DOCX and XLSX preview in particular require server-side conversion, which is a service, not a library call. The JPG rejection and the scanner requirement directly contradict each other.
**Recommendation:** Release 1 accepts PDF (native and scanned), DOCX, XLSX and TXT, matching US-33. Images are accepted only through the scanner capture path and converted to PDF on ingest. Anything else is rejected. Confirm whether DOC, XLS, PPTX and CSV are needed, because each adds real work.

**Q4.2** How does the system distinguish a duplicate (US-03), a new version (US-21), and a new document? US-03 keys on identical content hash. US-21 keys on the same filename with different content.
**Why it matters:** This is the most under-specified rule in the backlog and it sits on the main flow. Four combinations exist and the stories describe only two. Same name and same content: duplicate or no-op? Different name and same content: US-03 rejects it as a duplicate, which means a member cannot upload a renamed copy of a colleague's document even for a legitimate different purpose. Same name and different content, uploaded by a different user into a different category: US-21 silently turns it into version 1.1 of someone else's document.
**Recommendation:** Decide the matrix explicitly before estimating either story. Engineering's default: a content hash match inside the same tenant is a duplicate and is rejected with a link to the existing document; an explicit "upload new version" action on an existing document creates a version; a filename match alone never creates a version implicitly. Implicit versioning by filename will cause data loss the first time two people both have a file called `laporan.pdf`.

**Q4.3** US-21 assigns v1.0 then v1.1. What causes a major version increment, and can a user set it?
**Why it matters:** A numbering scheme with no rule for the major component produces documents that sit at v1.47 forever, which makes the version picker useless.
**Recommendation:** Use a single incrementing integer (v1, v2, v3) unless the customer has a stated archival requirement for major and minor. Semantic versioning of documents needs a human decision at every upload, which no story describes.

**Q4.4** AC-07.01 and AC-33.01 both require search results in under 3 seconds. At what corpus size, what document size, and what concurrent user count?
**Why it matters:** Full text search over document contents including OCR text is the main scaling risk in the product, and 3 seconds is either trivially met or impossible depending on numbers nobody has stated. The choice between the database's built-in full text search and a dedicated search engine hangs on this, and that choice is expensive to reverse.
**Recommendation:** Ask for target figures: documents per tenant at launch and at 12 months, average and maximum page count, peak concurrent searches. Engineering's default until told otherwise: 100,000 documents per tenant, 50 pages average, 20 concurrent searches, which points at a dedicated search index rather than database full text search. Confirm before estimating US-07 and US-33, because it also decides whether US-31 can be met.

**Q4.5** Which AI provider processes the documents, and where does the data go?
**Why it matters:** The corpus is contracts, invoices, offering letters, and financial reports. Sending them to a third-party inference API is a data residency and confidentiality decision that belongs to the customer, not to engineering, and it may be flatly incompatible with the customers asking for US-31. It is also the main recurring cost of the product.
**Recommendation:** Raise this as a customer decision now, with two documented options: hosted inference (cheaper, faster to build, data leaves the tenant boundary) or self-hosted models (higher infrastructure cost, slower to build, data stays inside the boundary). The architecture must abstract the provider either way. Do not estimate US-04, US-05, US-06, US-25 or US-33 before this is answered.

**Q4.6** What languages must OCR and extraction handle?
**Why it matters:** Indonesian and English mixed within a single document is common in this corpus and materially affects OCR engine choice and accuracy.
**Recommendation:** Assume Indonesian and English. Confirm whether any other language appears in the customer's archive.

**Q4.7** What are the roles, and how do they relate? The stories use Member Team, Head of Team, Admin Tenant, and Super Admin, but US-41 defines menus for only the first three, US-14 gives permission control to Head of Team while US-26 gives retention control to Admin Tenant, and US-20 introduces separate signature roles.
**Why it matters:** Whether roles are nested (an Admin Tenant can do everything a Head of Team can) or disjoint changes every authorisation check. Whether one user can hold several roles changes the session model. Whether signature roles are system roles or a parallel concept changes the schema.
**Recommendation:** Produce a single role matrix listing every role against every action, as a document input to the sprint, not as a story. Engineering's default: roles are nested, one role per user per tenant, and signature roles from US-20 are a separate assignment that grants no system permissions. A Super Admin operates outside tenants entirely and needs its own navigation, which US-41 does not cover.

**Q4.8** Does the storage quota in US-35 belong to the tenant, the tier (US-16), or the user, and who sets it?
**Why it matters:** US-35 assumes a quota exists but no story creates one. If it is a tier attribute, US-35 depends on US-16, which is far down the backlog.
**Recommendation:** Quota is a per-tenant value defaulted from the tier and overridable by a Super Admin. Add the quota field to the tenancy foundation so US-35 does not have to wait for US-16.

**Q4.9** Does the corpus contain personal data subject to UU PDP, and what is the retention rule for the audit log itself?
**Why it matters:** Offering letters and employee documents are named in the stories. If personal data is in scope, deletion requests, access logging, and retention of the audit trail all become requirements, and the automatic destruction in US-26 interacts with them directly.
**Recommendation:** Assume personal data is in scope. Require that US-26 destruction is a soft delete with a documented purge window, that the audit record of a destruction survives the destruction, and that legal hold can suspend automatic destruction. Permanent hard deletion with no hold mechanism is the risk to flag.

**Q4.10** Which unknowns should be spiked before any number is committed?
**Recommendation:** Four, in priority order. First, the duplicate and version rule matrix (Q4.2), because it blocks the main flow. Second, AI classification and extraction accuracy on a labelled sample of the customer's real documents (Q3.1), because it decides whether US-06 and US-25 are viable at all. Third, deep content search performance at target corpus size (Q4.4), because it decides the search architecture. Fourth, the e-signature legal regime (Q2.4), because it decides whether US-17 to US-20 are one sprint or one quarter.

---

## S: Small

**Q5.1** Which of these are stories and which are epics? On current wording, US-15, US-16, US-23, US-24, US-27, US-29, US-30, US-31 and US-32 are each multi-sprint bodies of work carrying a single happy-path acceptance criterion.
**Why it matters:** A story that cannot finish inside a sprint will not finish inside a sprint just because it was pointed as though it could.
**Recommendation:** Reclassify all nine as epics and decline to estimate them until they are split. Proposed splits below.

**Q5.2** Five stories bundle independent delivery targets behind one criterion.
**Why it matters:** Each target has its own SDK, its own review process, and its own failure modes. Bundling them hides most of the work.
**Recommendation:** Split per target, one thin end-to-end slice each.
- US-23 into email capture and scanner capture. Scanner capture also needs a hardware protocol decision (TWAIN, network scanner, or watched folder) that no story states.
- US-24 into Outlook add-in, Word add-in, and Gmail add-in. Each carries its own marketplace review.
- US-29 into SharePoint, Google Drive, and network drive. Ship one, learn, then decide on the others.
- US-30 into mobile (iOS and Android, if a cross-platform framework is used) and desktop (Windows and macOS). Ask whether a responsive web application meets the need first, because that removes both app store tracks.
- US-32 per ERP. Build the one the first customer actually runs.

**Q5.3** US-42 bundles a generic key-value configuration screen with the specific requirement to cap upload size. AC-42.01 through AC-42.04 describe a free-text Parameter Type and Parameter Value table.
**Why it matters:** An untyped configuration store has no validation. Nothing stops an administrator typing `Max File Size` as `twenty`, or misspelling the parameter name so it is silently ignored. The enforcement of the limit, which is the actual business requirement in the story title, has no acceptance criterion at all.
**Recommendation:** Split into two. First, enforce a tenant-configurable maximum upload size, with a rejection AC on US-01. Second, if a generic configuration screen is genuinely wanted, build it over a fixed set of known parameters, each with a declared type, a default, and validation. Free-text keys should be rejected as a design.

**Q5.4** Where is the seam for a first thin vertical slice of the product?
**Recommendation:** Login (US-40) plus the tenancy foundation, upload with size and type validation (US-01), document list and card view (US-38), preview (US-09), and title search (US-07). That slice is demonstrable, shippable, and exercises the storage, tenancy and authorisation spine everything else sits on. AI features come next, on top of the ingestion pipeline story from Q1.1.

**Q5.5** No story mentions migration, backfill, rollout, or rollback. Is that because the system is greenfield with no existing data?
**Why it matters:** If documents are being migrated from an existing share, SharePoint instance, or file server, that is a project of its own: bulk ingestion, deduplication at scale, back-processing through the AI pipeline, and the cost of that processing across the whole archive at once.
**Recommendation:** Confirm greenfield. If an existing archive is to be imported, raise it as a separate epic with its own budget, because running the AI pipeline over an entire legacy archive is likely to be the largest single processing cost in the project.

---

## T: Testable

**Q6.1** Four stories carry no acceptance criteria in the current file (US-12, US-20, US-24, US-32), and all four are explained by the misalignment in Section 0.
**Recommendation:** Confirm the mapping in Section 0, then verify each of the four ends up with the criterion the table assigns to it.

**Q6.2** Several criteria are not verifiable as written. Proposed replacements:

| ID | Problem | Proposed wording |
|---|---|---|
| AC-01.01 | "file muncul di progress upload bar" has no terminal state. A test cannot assert on a progress bar. | THEN the upload progress indicator reaches 100 percent AND the document appears in the uploader's "UPLOADED DOCUMENT" list with status "Processing" within 5 seconds. |
| AC-04.02 | "tidak menampilkan nama penulis" does not say whether the field is hidden or shows a placeholder. | THEN the Metadata section displays the Author field with the value "Tidak diketahui" AND the document remains openable and searchable. |
| AC-05.01 | "tag yang relevan" is not testable, and the panel's size and ordering are undefined. | THEN the "Top Tags" panel displays the 10 most frequently occurring tags in the tenant, ordered by document count descending AND each document card displays at most 3 tags. |
| AC-06.01 | Depends on "dokumen bertema Reporting", which is a judgement, not a fixture. | Name a specific fixture file and its expected category, and state the accuracy target separately as a non-functional requirement per Q3.1. |
| AC-09.01 | "isi dokumen secara utuh" does not say which formats the viewer renders. | Enumerate: PDF renders natively; DOCX, XLSX and TXT render through server-side conversion; assert that no file is written to the local download directory. |
| AC-07.01, AC-33.01 | "kurang dari 3 detik" with no stated corpus or load. | State the corpus size and concurrency the 3 second target is measured at, per Q4.4. |
| AC-42.01 to AC-42.04 | Test the configuration table UI but never test that the configured limit is enforced. | Add: GIVEN Max File Size is configured as 20 MB, WHEN a Member Team uploads a 25 MB file, THEN the system rejects it with "Ukuran file melebihi batas 20 MB" AND the file is not stored. |

**Q6.3** The following unhappy paths have no acceptance criteria anywhere in the backlog. Which are in scope?
**Why it matters:** Each is a state a user will reach in the first week, and each is invisible in the estimate until it is written down.
**Recommendation:** Treat the first four as required for release 1 and add criteria now.
- AI or OCR processing fails or times out. What does the user see, is it retried, is the document still usable?
- The upload is interrupted by a network drop or a closed tab. Is a partial file stored, and is the upload resumable?
- The file is corrupt, empty, or a password-protected PDF, so text extraction is impossible. What is the resulting state?
- Malware scanning. Nothing in the backlog scans uploaded files. A DMS that accepts arbitrary uploads and serves them back to colleagues distributes whatever it is given. This should be a required upload story, not an option.
- The session expires mid-upload.
- Empty states for the dashboard, the analytics page, and the audit trail on a brand new tenant.
- Storage quota crossed mid-batch: three files uploaded, quota exhausted after the second.

**Q6.4** AC-10.02 asserts only that the Download button is disabled when the category permission is inactive, and US-41 asserts only that menus are hidden for roles that lack access. Is authorisation enforced on the server?
**Why it matters:** A disabled button and a hidden menu are presentation. Neither prevents a direct request to the download or admin endpoint. As written, both criteria pass while the system is fully exploitable, and US-14 is a security story.
**Recommendation:** Add server-side criteria to both. A direct request to the download endpoint for a document in an inactive category returns 403 and writes an audit record; a direct request to an administrative endpoint by a Member Team returns 403. Apply the same to AC-14.02: tenant isolation must be tested by direct identifier access, not only through search.

**Q6.5** Concurrency and idempotency are not addressed anywhere.
**Recommendation:** Add criteria for two users uploading identical content simultaneously (one document created, the second sees the duplicate message); double-clicking Download (one file, one audit record, not two); two users saving the same retention policy (last write wins with a warning, or optimistic locking); version number allocation under concurrent uploads to the same document.

**Q6.6** Boundary values are unstated throughout.
**Recommendation:** Fix and document the maximum files per drag-and-drop batch (AC-01.04 uses three with no cap stated); the minimum search query length; behaviour when the AI returns more than the 3 tags US-05 allows (truncate by confidence); maximum filename length and handling of duplicate filenames; page size in US-39 (fixed at 10 or user-selectable) and behaviour when a filter reduces results below one page; maximum bulk download size in US-11, because zipping an unbounded selection is a denial of service against your own server.

**Q6.7** Interface strings mix Indonesian and English within the same backlog: "File diterima untuk diproses", "Document not found", "Showing 1 - 10 of 123 records", "Success adding new configuration", "Tidak ada dokumen pada kategori ini".
**Why it matters:** Either the product is bilingual, in which case internationalisation is an unwritten story affecting every screen, or the strings are simply inconsistent and QA has no source of truth for what to assert.
**Recommendation:** Pick Indonesian as the single interface language for release 1 and normalise every string in the AC set. If bilingual is required, add an internationalisation story and stop hard-coding strings in acceptance criteria; assert on message keys instead.

**Q6.8** What is the definition of done for this team?
**Why it matters:** Every estimate in the meeting assumes an answer to this, and different people in the room are assuming different ones.
**Recommendation:** Agree and write down: unit and integration tests for new logic, an automated end-to-end test per acceptance criterion on the main flows, a server-side authorisation test for every role-gated route, updated API documentation, processing state and error alerting in place for asynchronous work, and analytics events emitted for the metrics in Q3.3.

---

## Verdict

### INVEST scorecard

| Lens | Verdict | Biggest gap |
|---|---|---|
| **I** ndependent | FAIL | Multi-tenancy (US-15), the AI ingestion pipeline, the permission model (US-14), and the versioning schema are foundations sitting in the middle of the backlog. Roughly twenty stories cannot be built independently of them, and building them in the stated order means re-migrating and re-auditing work already delivered. |
| **N** egotiable | FAIL | US-02 and US-06 specify contradictory behaviour for the same upload flow, and no story states which wins. The e-signature scope (legally binding versus internal approval) is undeclared and is the largest cost fork in the document. |
| **V** aluable | WARN | The AI features that justify the product have no accuracy target, no correction path, and no measurement. US-12 measures uploads, which is ingestion, not adoption. |
| **E** stimable | FAIL | No volume, throughput or corpus figures anywhere; no decision on AI provider or data residency; no supported file type list that survives contact with US-23 and US-33; and the duplicate-versus-version rule that governs the main flow is undefined. |
| **S** mall | FAIL | Nine items are epics carrying one acceptance criterion each. Five of those bundle independent delivery targets (three add-ins, four operating systems, three repositories, three ERPs, two capture sources). |
| **T** estable | FAIL | AC blocks are attached to the wrong stories from US-09 onward, four IDs are duplicated, and the unhappy paths that matter most (processing failure, interrupted upload, malware, server-side authorisation) have no criteria at all. |

### Ready for estimation

**Not ready.**

The single blocker that must close first: **regenerate the source document so each acceptance criterion is attached to its own story with a unique ID** (Section 0). Until that is done, any number the team gives is attached to the wrong work.

Immediately behind it, and required before the affected stories can be sized: resolve the US-02 versus US-06 contradiction (Q2.1), and define the duplicate-versus-version rule matrix (Q4.2).

A subset can be estimated in this meeting once Section 0 is confirmed, because their criteria are correctly attached and self-contained: **US-07, US-09, US-13, US-34, US-36, US-37, US-38, US-39, US-40, US-41**. Everything else should leave the meeting with a question, a spike, or a split, not a number.

### Story splitting

Proposed reshaping, from foundation upward.

**New foundation stories, not currently in the backlog:**

1. Tenancy foundation: tenant model, request-scoped resolution, enforcement at the data access layer, quota field. Prerequisite for everything.
2. Document and version schema: one logical document, many versions, from the first migration.
3. Ingestion pipeline: text extraction, OCR, and a single structured AI result per document, with per-document processing state and failure handling.
4. AI override: any AI-produced field is correctable, and corrections are recorded and counted.
5. Malware scanning on upload.
6. Category taxonomy management, so US-06 writes into a governed structure.

**Splits of existing items:**

- US-23 into email capture, and scanner capture (with the hardware protocol decided first).
- US-24 into Outlook, Word and Gmail add-ins, each preceded by a marketplace access spike.
- US-29 into SharePoint, Google Drive and network drive; ship one first.
- US-30 into mobile and desktop, after confirming a responsive web application does not already meet the need.
- US-32 per ERP; build only the one the first customer runs.
- US-42 into enforcement of the upload size limit (release 1) and the generic configuration screen (later, with typed parameters).
- US-15 into tenant CRUD, tenant status lifecycle, and Super Admin navigation, which US-41 does not cover.
- US-16 into tier definition, and per-tenant feature flag evaluation across navigation and API.
- US-27 dropped from release 1 in favour of US-17, or promoted to an epic with US-17 and US-20 dropped.

**Sequencing note:** US-31 (on-premises) should be decided before release 1 architecture but built after it. Its answer constrains the choice of search engine, object storage, and inference provider made in Q4.4 and Q4.5.

### Acceptance criteria gaps

Ranked by risk.

1. **Server-side authorisation is never asserted.** AC-10.02 and US-41 test only that controls are hidden or disabled. Both pass on a system that is fully exploitable by direct request. Add 403 assertions with audit records.
2. **Tenant isolation is tested only through search** (AC-14.02). Add direct identifier access, download endpoint, and API assertions.
3. **No malware scanning criterion exists.** A DMS that accepts arbitrary uploads and serves them back to colleagues without scanning distributes whatever it is given.
4. **No processing failure path.** OCR failure, extraction timeout, corrupt file, and password-protected PDF all currently present to the user as a document that silently never appears.
5. **The upload size limit has no enforcement criterion,** only criteria for the screen that configures it (Q6.2).
6. **Duplicate and version behaviour is undefined for two of four cases** (Q4.2), and one plausible reading of US-21 silently overwrites another user's document.
7. **No interrupted upload, session expiry, or quota-exhausted-mid-batch path.**
8. **No empty states** for a new tenant on the dashboard, analytics, and audit trail.
9. **No concurrency criteria** for simultaneous identical upload, double-submitted download, or concurrent version allocation.
10. **Untestable wording** in AC-01.01, AC-04.02, AC-05.01, AC-06.01 and AC-09.01, with proposed replacements in Q6.2.

---

## Next step

This file is written for the refinement meeting. No changes have been made to `docs/us-ac/User-Stories-and-AC.md`; every proposal above is for the BA to ratify or override.

Once the BA has answered, grooming can be re-run in interview mode to fold the decisions back into the user stories and acceptance criteria as concrete Add, Remove and Edit changes.

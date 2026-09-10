# Archiva Glossary

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Definitions only. Where a term has a user-facing Indonesian label it is quoted verbatim; that string is the contract and is never translated in code.

If a term is missing here, add it rather than defining it locally in a spec or a comment.

## Organisation and people

**Tenant** (UI label: "Organisasi")
One client organisation. The isolation boundary of the entire system: data belonging to one tenant is unreachable from another, including by direct identifier. Resolved from the subdomain on every request.

**Subdomain**
The DNS label identifying a tenant, for example `contohbaru` in `contohbaru.archiva.id`. Lowercase, DNS-safe, unique across the platform.

**User** (UI label: "Pengguna")
One person's account within one tenant. A person needing access to two tenants needs two accounts.

**Member Team** (`member`)
The base role. Uploads documents, confirms categories on their own documents, searches, previews, and downloads what the taxonomy permits.

**Head of Team** (`head_of_team`)
Inherits Member Team. Manages the category taxonomy, toggles download permission, reads the audit trail and analytics, and sees unconfirmed documents belonging to anyone.

**Admin Tenant** (`admin_tenant`)
Inherits Head of Team. Edits the tenant configuration parameters.

**Super Admin** (`super_admin`)
Operator staff. Sits outside every tenant and carries no tenant id. Creates tenants and sets storage quota. Never reads tenant document content.

**Role floor**
The minimum role a route requires. Everything above it inherits. Expressed as a floor rather than a set, so adding a role later requires no edit to existing guards.

## Documents

**Document** (UI label: "Dokumen")
One logical file in the archive, independent of how many versions it has. Identified by content, not by filename.

**Version**
One revision of a document, numbered from 1 upward with no gaps. Created only through an explicit action against a named document; uploading a same-named file to the dashboard creates a separate document instead.

**Content hash**
The SHA-256 of a file's bytes. Uniqueness within a tenant is decided on this, which is why two identical files cannot both be stored regardless of their filenames.

**Duplicate**
A file whose content hash already exists in the tenant. Rejected with a link to the existing document. A filename match is never a duplicate.

**Blob**
The stored bytes of one version, held in object storage under a key derived from ids, never from a filename.

**Uploaded Document** (UI label: "UPLOADED DOCUMENT")
The dashboard tray holding documents whose category the uploader has not yet confirmed. A document leaves the tray on confirmation.

## Processing lifecycle

**Pipeline**
The four fixed stages a document passes through after upload: scan, extract, classify, index. The order is not configurable; scanning first is a security property, not an optimisation.

**Processing state**
Exactly four values, and no others.

| State | UI label | Meaning |
|---|---|---|
| `queued` | "Antre" | Accepted, waiting for a worker |
| `processing` | "Diproses" | A worker is running the stages, including retries |
| `ready` | "Siap" | Every stage succeeded |
| `failed` | "Gagal" | Retries exhausted, or the input is unrecoverable |

**Failure reason**
Why a document reached `failed`. `password_protected` renders "Dokumen terproteksi password"; `unreadable_content` renders "Isi dokumen tidak dapat dibaca". A failed document stays listed, previewable where possible, and downloadable: failure removes derived data, never the document.

**Transient versus permanent failure**
Network, timeout, 5xx and rate limit are transient and retry three times with exponential backoff. Malformed input, password protection and unreadable content are permanent and skip straight to `failed`.

**Extraction**
Reading text out of a file, natively where the format allows and by OCR where it does not. Produces one row per page, which is the unit search indexes.

## Classification

**Category** (UI label: "Kategori")
An administrator-managed label a document is filed under. The AI never creates one.

**Uncategorized**
The reserved system category holding documents the AI could not place. Present in every tenant from creation, and cannot be renamed.

**Suggestion** (UI label: "Saran")
The category the AI proposed, shown with a marker until a person confirms it. The original suggestion is retained permanently even after an override, because that pair is the accuracy metric.

**Confirmation**
A person accepting or replacing the suggested category. Records who confirmed and when, and removes the document from the Uploaded Document tray.

**Confirmation window**
The period during which an unconfirmed document is visible to its uploader alone. Governed by `pending_confirmation_days`, default 7. After it elapses the document becomes visible tenant-wide, still unconfirmed. Head of Team and above bypass the window entirely.

**Download permission**
A per-category flag governing whether its documents may be downloaded. A new category always starts Inactive; activating it is a second, audited action. A change takes effect on the very next request.

**Document type**
What kind of document the AI recognised the content to be, for example "Invoice". Distinct from category, which is the tenant's own taxonomy.

**Tag**
A keyword the AI derived from content. At most three per document, kept by descending confidence and truncated when written, not when read.

**Top Tags**
The ten most-used tags in a tenant, ordered by document count, used as a dashboard filter.

## Search

**Title search**
Search across document titles and metadata. Returns one hit per document.

**Deep content search**
Search across the words inside files. Returns the page number the match was on plus a highlighted snippet from that page, which is why the index unit is a page rather than a document.

**Page document**
One entry in the search index, representing a single page of a single version. Roughly 5 million per tenant at the target corpus size.

**Index lag**
Seconds between the newest indexed page and the newest ready document. A monitored signal, reported by the health monitor.

**Related documents** (UI label: "Dokumen Terkait")
Up to five other documents sharing a category or a tag with the one being viewed, always within the same tenant.

## Governance and operations

**Audit event**
One row in the append-only ledger recording who did what to which subject, and whether it was allowed or denied. Denials are first-class: a refused download must appear in the trail.

**Audit trail**
The Head of Team view over the ledger, showing Siapa (user), Apa (document name), Aksi (action) and Kapan (time).

**Analytics rollup**
A precomputed metric the dashboard reads instead of scanning raw events, so the dashboard stays fast as the ledger grows.

**Override rate**
The proportion of AI-suggested values a person changed. The measure of AI quality, and the reason the original AI value is never overwritten.

**Storage quota**
The byte ceiling on a tenant's stored documents. Set by Super Admin only, and read-only in the tenant configuration screen.

**Quota reservation**
Capacity held before a blob is written and committed after the row lands, or released on failure. Reserving is the only correct way to check quota; reading usage and then deciding is a race.

**Configuration parameter**
One of exactly three tenant settings: `max_file_size_mb`, `pending_confirmation_days`, and `storage_quota_gb`. A closed set, never a free-text name.

**Health monitor**
The readiness endpoint reporting each dependency separately. A dependency the system survives without degrades; PostgreSQL cannot degrade, it downs.

**Reset state**
Returning an environment to schema-at-head plus its seed dataset. Permitted in dev, test, SIT and UAT. In production the route is not mounted at all.

**Seed**
A version-controlled, idempotent dataset. The `dev` seed covers every role and processing state; the `qa` seed adds every fixture an acceptance criterion names by filename.

## Delivery vocabulary

**Card**
One unit of engineering work in the task breakdown, owned by one person and satisfying named acceptance criteria. Becomes one GitHub issue.

**Wiring card**
A card owning the integration between a backend card and a frontend card: pointing the real client at the real server and proving the criteria end to end. Owned by whoever owns the last card that unblocks it.

**Acceptance criterion (AC)**
One Given/When/Then scenario the system must satisfy, identified as `AC-<story>.<number>`. The unit this project is judged on.

**User story (US)**
One user-facing capability, identified as `US-<number>`, holding a set of acceptance criteria.

**SCAFFOLD**
The only permitted deferral marker in merged code. Names the card that replaces it. A stub body throws rather than returning a plausible-looking value; a wiring note is a comment marking a seam. `TODO` and `FIXME` are review findings.

**Verification gate**
`bun run complete-check`: typecheck, lint, format check and tests. A card is not done until it passes.

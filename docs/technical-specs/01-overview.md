# 01 — Overview

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Archiva is a multi-tenant document management system. Members of a team upload documents, the system extracts their text, classifies them against a governed taxonomy, and makes them findable by title, metadata, tag, category, and by the words inside the file. Administrators govern who may download what, and every consequential action is recorded.

This document specifies how the system in `docs/business/` is built. It does not restate the requirements; it maps each technical decision back to the acceptance criterion that forces it.

## 1.1 Terminology

Domain terms and their user-facing labels live in `../GLOSSARY.md`. Where this specification names an entity it uses the code identifier and gives the UI label alongside, for example `CATEGORIES (UI label: "Kategori")`. Do not invent synonyms; if a term is missing from the glossary, add it there rather than defining it locally.

## 1.2 Language policy

Two languages, with a hard split.

| Surface | Language | Source |
|---|---|---|
| User-facing interface copy, messages, labels, errors | Indonesian | Grooming D15 |
| Code identifiers, table and column names, API field names, log messages, this specification | English | This document |

Acceptance criteria quote Indonesian strings verbatim, for example `"File diterima untuk diproses"`. Those strings are the contract. Never translate one in code, and never assert on an English paraphrase in a test.

## 1.3 Goals

1. A member can put a document into the system and find it again by its contents, without organising it by hand.
2. Classification is proposed by the system and confirmed by a person, so accuracy is measurable rather than assumed.
3. Data belonging to one organisation is unreachable from another, provably, including by direct identifier.
4. Download of sensitive categories is governable, and every access attempt is on the record.
5. Nothing fails silently. A document whose processing breaks stays visible, usable, and explains itself.

## 1.4 Scope by module

### 1.4.1 tenancy

Tenant creation and lifecycle (US-43), per-tenant configuration parameters and their validation (US-42), storage quota accounting with warning and rejection thresholds (US-35).

### 1.4.2 identity

Email and password authentication, session lifecycle including idle expiry (US-40), the nested role model and role-derived navigation (US-41), and server-side authorisation on every role-gated route (AC-41.05, AC-14.03, AC-47.03).

### 1.4.3 catalog

Upload including batch, type, size and quota validation (US-01), content-hash duplicate rejection and the filename-collision rule (US-03), document and version model with explicit version creation (US-21), card presentation (US-38), preview via native render and server-side conversion (US-09), single and bulk download with audit records (US-10, US-11).

### 1.4.4 classification

Category taxonomy management and the default-inactive download flag (US-45), category suggestion confirmation and override (US-02), automatic category and document-type assignment from content (US-06), the download permission toggle and its predicate (US-14), category filtering (US-34).

### 1.4.5 enrichment

The processing pipeline and its visible state machine (US-44), author and creation-date metadata extraction (US-04), automatic tagging capped at three per document (US-05), correction of any AI-produced field with the original value retained (US-47).

### 1.4.6 search

Title and metadata search (US-07), deep content search with page-level highlighting (US-33), related-document suggestion by shared category or tag (US-08).

### 1.4.7 activity

The generic audit event ledger and its download and denial views (US-13), and the analytics dashboard covering volume, retrieval, and AI quality metrics (US-12).

### 1.4.8 platform

The health monitor endpoint, the non-production reset-state endpoint, and the migration and seed runner.

### 1.4.9 Out of scope

Explicitly not built in release 1, held as roadmap in `../us-ac/User-Stories-and-AC.md`:

- E-signature in any form, US-17 through US-20. The legal regime is undecided (grooming Q2.4).
- Visual approval workflow design, US-27.
- Tenant lifecycle administration UI beyond creation, and SaaS tiering with per-tenant feature flags, US-15 and US-16.
- Capture from email, scanner, or office plugins, US-23 and US-24.
- Structured field extraction from invoices, US-25. The enrichment pipeline is built to carry it; the extraction itself is not.
- Retention policy and automatic destruction, US-26.
- Physical archive circulation, US-28.
- External repository federation, native desktop and mobile applications, on-premises installer, and ERP integration, US-29 through US-32.

On-premises deployment is out of scope as a deliverable but binding as a constraint: every infrastructure dependency in `04-tech-stack.md` has a self-hostable equivalent (grooming D8).

## 1.5 User base

Four roles, nested, one per user per tenant (grooming D10).

| Role | Scope | Population |
|---|---|---|
| Member Team | One tenant | Majority of accounts |
| Head of Team | One tenant, inherits Member Team | A few per tenant |
| Admin Tenant | One tenant, inherits Head of Team | One or two per tenant |
| Super Admin | Outside all tenants | Operator staff only |

## 1.6 Business workflow summary

```
MEMBER TEAM: put a document in and find it later
  drag file onto dashboard
  system validates      type in PDF, DOCX, XLSX, TXT
                        size <= tenant.max_file_size
                        tenant.storage_used < tenant.storage_quota
                        batch size <= 20
  system stores blob, computes content hash
  IF hash already present in this tenant
      reject, show link to the existing document
      STOP
  document state := QUEUED
  worker: scan for malware   -> infected? reject, audit, STOP
  worker: extract text       -> native layer, else OCR
  worker: ask AI for category suggestion, type, tags, metadata
  document state := READY, or FAILED with a reason and still usable
  member sees suggested category marked "Saran"
  member confirms or overrides   -> override recorded with the original value
  document leaves the UPLOADED DOCUMENT tray
  later: member searches a phrase, gets the page and the highlighted snippet

HEAD OF TEAM: govern the taxonomy and watch adoption
  create categories          -> download permission starts Inactive
  review the Uncategorized queue
  toggle download permission -> effective on the next request
  read the audit trail: who downloaded what, and who was refused
  read analytics: uploads, searches, zero-result rate, AI override rate

ADMIN TENANT: set the operating limits
  edit configuration parameters, max file size and confirmation window
  read storage quota, set by Super Admin and not editable here

SUPER ADMIN: run the platform
  create a tenant, set its storage quota
  never reads tenant document content
```

## 1.7 Assumptions and known constraints

1. Greenfield. No existing archive is migrated. If one appears, bulk ingestion and back-processing the whole corpus through the AI pipeline is a separate project with its own budget (grooming Q5.5).
2. Corpus target is 100,000 documents per tenant at twelve months, 50 pages average, 20 concurrent searches at peak (grooming D9). This is an assumption, not a measurement, and it is the single number that forces OpenSearch.
3. AI classification accuracy on the customer's real documents is unmeasured. A spike against a labelled sample must run before US-06 is committed (grooming Q3.1).
4. Documents are processed by a hosted inference provider. Which provider sees tenant content, and under what retention terms, is an open commercial question that does not block engineering (grooming D8).
5. Personal data is assumed in scope under UU PDP. Offering letters and employee documents are named in the business docs.
6. OCR handles Indonesian and English. No other language is supported.
7. Version numbering is a simple incrementing counter: v1, v2, v3 (grooming D6).
8. Category taxonomy is administrator-managed. The AI never creates a category (grooming D3).
9. One role per user per tenant. A user needing access to two tenants needs two accounts.
10. Release 1 runs cloud-only on a single host. Horizontal scaling and on-premises packaging are deferred but not designed out.
11. AC-42.01 lists storage quota on the Admin Tenant Configuration page, but quota is set by Super Admin and shown read-only there. AC-42.01 needs a read-only marker added in the source document.

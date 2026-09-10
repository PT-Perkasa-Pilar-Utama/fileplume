# 02 — System Architecture

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

## 2.1 Style: modular monolith plus a worker

One codebase, two deployables. `apps/api` serves HTTP through Hono. `apps/worker` consumes BullMQ queues. Both import the same modules from `packages/`, both talk to the same PostgreSQL instance, neither talks to the other over the network.

### 2.1.1 Why this shape

Archiva has exactly one workload that differs in kind from the rest. OCR and AI inference are slow, CPU-heavy, and bursty: a single 50-page scanned PDF can occupy a core for a minute. Everything else, upload, search, permission checks, audit reads, analytics, is ordinary request and response work against one shared database.

Splitting that one workload onto its own process buys real isolation. AC-33.01 promises search results in under 3 seconds; without a separate worker, that promise is hostage to whatever someone just uploaded.

Splitting the *rest* into services buys nothing here and costs a great deal. Upload-then-index would become a cross-service transaction. Debugging one upload would require distributed tracing. Every on-premises customer under the roadmap US-31 would need to run eight containers instead of two.

US-16 uses the phrase "modul microservice per tenant". That story is roadmap, and its actual requirement is per-tenant module gating, which is a flag check at route registration. A module does not need to be a process to be switched off.

### 2.1.2 Module boundary rule

Modules are packages under `packages/`. Each exposes a single public entry point. **A module never imports another module's internals.** Cross-module calls go through the exporting module's public surface, documented in `05-module-definitions.md`. Enforced by lint rule, not convention.

## 2.2 Component graph

```mermaid
graph TB
  subgraph Client
    WEB[React SPA<br/>Vite, TanStack Router]
  end

  subgraph API["apps/api (Hono)"]
    RT[Routes + Zod validation]
    ID[identity]
    TN[tenancy]
    CAT[catalog]
    CLS[classification]
    SR[search]
    ACT[activity]
    PLT[platform]
  end

  subgraph WORKER["apps/worker (BullMQ)"]
    ENR[enrichment pipeline]
  end

  subgraph Data
    PG[(PostgreSQL 17)]
    OS[(OpenSearch 2.x)]
    VK[(Valkey)]
    S3[(S3 / MinIO)]
  end

  subgraph Sidecars
    CLAM[ClamAV]
    GOT[Gotenberg]
  end

  subgraph External
    AI[AI provider]
  end

  WEB -->|REST, cookie session| RT
  RT --> ID & TN & CAT & CLS & SR & ACT & PLT
  CAT -->|enqueue| VK
  VK -->|consume| ENR
  ID & TN & CAT & CLS & ACT --> PG
  ENR --> PG
  SR --> OS
  ENR -->|index pages| OS
  CAT --> S3
  ENR --> S3
  ENR --> CLAM
  CAT --> GOT
  ENR --> AI
  SR --> VK
```

## 2.3 Request lifecycle: upload through to searchable

```mermaid
sequenceDiagram
  autonumber
  actor M as Member Team
  participant API as apps/api
  participant PG as PostgreSQL
  participant S3 as Object store
  participant Q as Valkey / BullMQ
  participant W as apps/worker
  participant AV as ClamAV
  participant AI as AI provider
  participant OS as OpenSearch

  M->>API: POST /documents (multipart)
  API->>API: authn, resolve tenant, check role
  API->>API: validate type, size, batch, quota
  API->>API: stream to temp, compute SHA-256
  API->>PG: SELECT by (tenant_id, content_hash)
  alt hash already present
    API-->>M: 409 "File ini sudah ada di sistem" + link
  else new content
    API->>S3: put blob at tenant-prefixed key
    API->>PG: INSERT document + version, state=QUEUED
    API->>Q: enqueue process(documentId)
    API-->>M: 202 "File diterima untuk diproses"
  end

  W->>Q: consume
  W->>PG: state=PROCESSING
  W->>AV: scan blob
  alt infected
    W->>S3: delete blob
    W->>PG: delete document, write audit event
  else clean
    W->>W: extract native text, OCR pages without a text layer
    W->>AI: classify, type, tags, metadata
    W->>PG: persist text, suggestion, tags, metadata
    W->>OS: bulk index one document per page
    W->>PG: state=READY
  end

  M->>API: GET /search?q=...
  API->>OS: query with tenant filter + highlight
  OS-->>API: hits with page number and fragment
  API-->>M: results in under 3 seconds
```

## 2.4 Deployment graph

```mermaid
graph LR
  subgraph VPS["Single VPS, Docker Compose"]
    subgraph app["Application containers"]
      A1[api]
      W1[worker]
    end
    subgraph data["Stateful containers + volumes"]
      P[(postgres:17)]
      O[(opensearch:2)]
      V[(valkey:8)]
      MI[(minio)]
    end
    subgraph side["Stateless sidecars"]
      C[clamav]
      G[gotenberg]
    end
    CAD[Caddy<br/>TLS, static SPA]
  end

  NET((Internet)) --> CAD
  CAD --> A1
  CAD -->|serves built SPA| NET
  A1 --> P & O & V & MI & G
  W1 --> P & O & V & MI & C
```

The same compose file is the on-premises artifact under the roadmap US-31. A customer runs it on their own hardware, swapping the AI provider adapter for the self-hosted one.

## 2.5 Boundary map

| Module | Owns tables | Depends on (public surface only) | External seam |
|---|---|---|---|
| `tenancy` | tenants, tenant_config | none | none |
| `identity` | users, sessions | tenancy | none |
| `catalog` | documents, document_versions | tenancy, classification, activity | BlobStore, DocumentConverter |
| `classification` | categories, category_permissions | tenancy, activity | none |
| `enrichment` | document_text, document_tags, ai_field_overrides | catalog, classification, search | TextExtractor, AiProvider, MalwareScanner |
| `search` | none, owns the OpenSearch index | tenancy | SearchIndex |
| `activity` | audit_events, analytics_rollups | tenancy | none |
| `platform` | none | all, for health checks only | every port, for readiness |

No cycles. `enrichment` depends on `catalog`, never the reverse: `catalog` publishes a job and forgets it.

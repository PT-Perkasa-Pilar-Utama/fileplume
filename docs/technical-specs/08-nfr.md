# 08 — Non-Functional Requirements

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Every number has a source. A number sourced to "grooming D9" is an assumption the team agreed to build against, not a measurement; those are the ones to revisit once a real customer archive is sized.

## 8.1 Volume

| Metric | Target | Source |
|---|---|---|
| Documents per tenant at 12 months | 100,000 | Grooming D9 |
| Average pages per document | 50 | Grooming D9 |
| Page rows per tenant | 5,000,000 | Derived |
| Average document size | 2 MB | Assumption, revisit after pilot |
| Storage per tenant | 200 GB at target volume | Derived |
| Default quota | 50 GB | 06-data-model.md 6.3 |
| Tenants at 12 months | 10 to 20 | Assumption |
| Index documents across the cluster | 50M to 100M | Derived |

## 8.2 Latency budgets

Measured at the 95th percentile, at the 8.1 volume, under the 8.3 concurrency.

| Operation | Budget | Source |
|---|---|---|
| Title and metadata search | < 3 s | AC-07.01 |
| Deep content search with highlight | < 3 s | AC-33.01 |
| Document appears in the tray after upload | < 5 s | AC-01.01 |
| Document list, one page of 10 | < 500 ms | Derived from AC-39.01 |
| PDF preview first page | < 2 s | Derived from AC-09.01 |
| Office preview via Gotenberg | < 8 s | Conversion is a sidecar round trip |
| Permission toggle effective | Next request | AC-14.02 |
| Analytics dashboard | < 1 s | Reads rollups, AC-12.01 to 12.03 |
| Audit trail page | < 1 s | AC-13.01 |

The two 3-second budgets are the binding constraints on the whole design. They are why OpenSearch is in the stack and why indexing is asynchronous.

## 8.3 Throughput and concurrency

| Metric | Target | Source |
|---|---|---|
| Concurrent searches at peak | 20 | Grooming D9 |
| Concurrent active users per tenant | 50 | Assumption |
| Uploads per hour at peak | 500 | Assumption |
| Upload batch size | 20 files | AC-01.05 |
| Bulk download selection | 50 documents | AC-11.03 |
| Worker concurrency | 4 jobs per worker process | Tunable, starts at 4 |
| Documents processed per hour | 200 to 400 | Derived, OCR-bound |

Processing throughput is the number most likely to disappoint. A 50-page scanned PDF is OCR-bound and can take minutes. The queue absorbs bursts; the visible consequence is that `processing_state` stays `PROCESSING` longer, which AC-44.01 already accounts for by showing the state.

## 8.4 Availability

| Metric | Target | Notes |
|---|---|---|
| API availability | 99.5% monthly | Single VPS, roughly 3.6 hours of allowed downtime |
| Planned maintenance | Outside 08:00 to 18:00 WIB | |
| RPO | 24 hours | Nightly database and object store backup |
| RTO | 4 hours | Restore onto a fresh host from compose plus backup |
| Degraded operation | Search and AI may be down while upload, preview and download continue | 05-module-definitions.md 5.8.1 |

99.5% is a single-host target. A higher figure requires the Kubernetes path rejected in 04-tech-stack.md 4.9, and should be revisited when a customer contract demands it.

## 8.5 Scaling assumptions

| Dimension | First limit | Response |
|---|---|---|
| Upload burst | Worker concurrency | Add worker replicas; the queue already decouples them |
| Search volume | OpenSearch heap | Add a data node, or shard per tenant |
| Database connections | Single Postgres instance | PgBouncer, then a read replica for analytics |
| Storage | VPS disk | Object storage is already external; move MinIO to R2 or S3 |
| Tenants | Shared schema contention | Partition the large tables by `tenant_id` |

None of these is designed in for release 1. Each is a known move with a known trigger, which is the point of writing them down.

## 8.6 Accuracy targets

These have no measurement yet. They are the bar the spike in `01-overview.md` 1.7 item 3 must clear before US-06 is committed.

| Metric | Proposed target | Measured by |
|---|---|---|
| Category top-1 accuracy | 85% | Override rate in AC-12.03 |
| Document type accuracy | 85% | Override rate |
| Tag relevance | Not targeted in release 1 | Override rate, observed only |
| OCR character accuracy on Indonesian scans | 95% | Spike against a labelled sample |
| Zero-result search rate | Below 15% | AC-12.02 |

Override rate is the honest measure and the only one available in production, which is exactly why grooming D12 made every AI-produced field correctable and made the original value permanent.

## 8.7 Observability targets

Required for the alerting in grooming D13.

| Signal | Threshold | Action |
|---|---|---|
| Queue depth | Above 500 for 10 minutes | Page |
| Processing failure rate | Above 5% over 1 hour | Page |
| Index lag | Above 60 s for 5 minutes | Page |
| AI provider p95 latency | Above 10 s | Warn, health reports degraded |
| AI provider error rate | Above 10% over 15 minutes | Page |
| Database connection saturation | Above 80% | Warn |
| Storage quota per tenant | Above 90% | Notify the tenant's Admin |
| `/health/ready` down | Any | Page |

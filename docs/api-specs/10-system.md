# 10 — System

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The operational contract deployment and QA rely on. Module: `platform` ([../technical-specs/05-module-definitions.md 5.8](../technical-specs/05-module-definitions.md)). It owns no tables; it owns the migration runner and these routes.

No user story covers this file. It exists so an orchestrator can tell whether the process is healthy and so QA can reset an environment without a host session.

These operations sit outside `/api/v1`. They are infrastructure contracts rather than application resources, they are consumed by load balancers and CI rather than by the SPA, and versioning them with the application API would tie a health check to a business-API major version.

## 10.1 Authentication for operational endpoints

No session and no role. Two distinct shared tokens, so that granting a monitoring system read access does not hand it the ability to wipe an environment.

| Endpoint | Credential | Source |
|---|---|---|
| `GET /health/live` | None | Public in every environment |
| `GET /health/ready`, `GET /health` | `Authorization: Bearer <HEALTH_TOKEN>` | `HEALTH_TOKEN`, set in every environment including dev |
| `POST /admin/reset-state`, `GET /admin/reset-state/:jobId` | `Authorization: Bearer <RESET_API_TOKEN>` | `RESET_API_TOKEN`, absent in production |

`/health/ready` requires its token in dev as well, so nobody develops against a laxer contract than production enforces ([../technical-specs/11-environment-configuration.md 11.5](../technical-specs/11-environment-configuration.md)).

## 10.2 GET /health/live

**Signature.** `GET /health/live`

**Purpose.** Liveness. Answers one question: is this process running.

**Access.** Public, unauthenticated, in every environment. A load balancer must be able to reach it.

**Input.** None.

**Behavior.** Returns immediately. Touches no dependency, opens no connection, and reads no configuration beyond the version string. A liveness probe that consults PostgreSQL restarts a healthy process during a database blip.

**Output.** `200 OK`, whenever the process is up.

```json
{ "status": "ok", "version": "1.4.2" }
```

Note the absent `data` envelope. Operational endpoints return their payload at the top level, because the consumers are probes and shell scripts rather than the SPA.

**Errors.** None. A non-200 from this path means the process is not serving.

**Traceability.** [../technical-specs/05-module-definitions.md 5.8.1](../technical-specs/05-module-definitions.md).

## 10.3 GET /health/ready

**Signature.** `GET /health/ready`. `GET /health` is an alias.

**Purpose.** Readiness. Checks every critical dependency and reports each one separately.

This is the redundancy measure that catches a half-broken state: the application running against a wiped or unreachable database on a separate host. A process that is up but cannot reach PostgreSQL passes liveness and must fail readiness.

**Access.** `Authorization: Bearer <HEALTH_TOKEN>`. The per-dependency breakdown names internal topology and reports queue depth and index lag, which is reconnaissance material ([../technical-specs/07-security.md 7.6.1](../technical-specs/07-security.md)).

**Input.** None.

**Behavior.** Probes each dependency in parallel with a short timeout and reports latency. Aggregates to an overall status.

| Dependency | Check | Can degrade |
|---|---|---|
| `postgres` | Round-trip query | No. Unreachable means `down`. |
| `opensearch` | Cluster ping plus `indexLagSeconds` | No |
| `valkey` | Ping plus `queueDepth` | No |
| `blobStore` | Head on a known key | No |
| `clamav` | clamd ping plus `signatureAge` | No |
| `gotenberg` | Version probe | Yes. Preview of Office formats stops; everything else works. |
| `aiProvider` | Lightweight reachability probe | Yes. Classification stalls; upload, search and download work. |

A dependency the system survives without degrades; PostgreSQL cannot degrade, it downs.

**Output.** `200 OK` for `ok` and `degraded`, `503` for `down`.

```json
{
  "status": "degraded",
  "version": "1.4.2",
  "checks": {
    "postgres":   { "status": "ok", "latencyMs": 3 },
    "opensearch": { "status": "ok", "latencyMs": 11, "indexLagSeconds": 2 },
    "valkey":     { "status": "ok", "latencyMs": 1, "queueDepth": 4 },
    "blobStore":  { "status": "ok", "latencyMs": 22 },
    "clamav":     { "status": "ok", "signatureAge": "2h" },
    "gotenberg":  { "status": "ok", "latencyMs": 30 },
    "aiProvider": { "status": "degraded", "latencyMs": 1900 }
  }
}
```

Overall `status` is `ok`, `degraded` or `down`. `degraded` returning `200` is deliberate: an orchestrator must not pull a container out of rotation because a hosted inference provider is slow.

`indexLagSeconds` and `queueDepth` are the numbers the alerting in grooming D13 watches. They are reported here rather than by a search or queue endpoint, so there is one place to look.

**Errors.**

| status | condition |
|---|---|
| 401 | Missing or wrong `HEALTH_TOKEN` |
| 503 | Overall status is `down` |

**Traceability.** [../technical-specs/05-module-definitions.md 5.8.1](../technical-specs/05-module-definitions.md), [../technical-specs/07-security.md 7.6.1](../technical-specs/07-security.md), [../technical-specs/08-nfr.md 8.7](../technical-specs/08-nfr.md).

## 10.4 POST /admin/reset-state

**Signature.** `POST /admin/reset-state`

**Purpose.** Drop the schema, re-migrate, reseed, and clear every downstream store, so QA can start from a known state.

**Access.** Token, not a role. The route is registered only when `APP_ENV` is one of `dev`, `test`, `sit`, `uat` and `ENABLE_RESET_API=true`.

In production the route does not exist. This is enforced at route registration, not by an authorization check inside a handler ([../technical-specs/07-security.md 7.6.2](../technical-specs/07-security.md)):

```ts
if (config.APP_ENV !== "production" && config.ENABLE_RESET_API) {
  app.route("/admin", resetStateRoutes);
}
```

An authorization check is code that can be misconfigured; a route that exists is a route that can be reached. In production the branch never runs, the handler is never registered, and the path returns the same `404` as any unknown URL. There is no `403` to distinguish it, because a `403` would confirm the endpoint exists.

Three enforcement layers, in order of reliability ([../technical-specs/11-environment-configuration.md 11.5](../technical-specs/11-environment-configuration.md)):

1. Route registration, as above.
2. Schema refusal. `packages/config` fails startup if `ENABLE_RESET_API` or `RESET_API_TOKEN` is set while `APP_ENV=production`. A misconfigured production deploy does not boot, rather than booting dangerously.
3. A CI test that builds the app with a production configuration and asserts this path returns `404`.

Layer 3 is the one that holds the line. The rule is only real if a test fails when someone breaks it.

**Input.** Headers and JSON body.

```
Authorization: Bearer <RESET_API_TOKEN>
Content-Type: application/json
```

| field | type | required | notes |
|---|---|---|---|
| `seed` | enum `dev`, `qa` | no | Defaults to `RESET_DEFAULT_SEED` |
| `confirm` | string | yes | Must equal `reset-<APP_ENV>`, for example `reset-sit` |

```json
{ "seed": "qa", "confirm": "reset-sit" }
```

The `confirm` value is environment-bound so a request captured from SIT cannot be replayed against UAT. A mismatch is `422`, and the attempt is still audited.

**Behavior.**

1. Validate the token, then `confirm`. Write an `admin.reset_state` audit event before anything is dropped. The ledger is about to be destroyed, so the durable record of intent is the application log; the event exists so a reset that fails partway still left a trace in whatever survived.
2. Return `202` with a `jobId` and run asynchronously. Dropping, re-migrating and reseeding exceeds any sane request timeout.
3. Sequence: drop schema, run migrations from the ledger, run the selected idempotent seed, purge the blob bucket prefix, delete and recreate the OpenSearch index, flush the queue.
4. Migrations run through the runner that resolves its folder relative to its own module and takes the connection string from the environment. Never an absolute path, never an inlined connection string, never a raw read of a single `.sql` file ([../technical-specs/06-data-model.md 6.11](../technical-specs/06-data-model.md)).
5. Seeds are idempotent: running one twice leaves the same state, and running it against a partially seeded database completes it rather than failing on a conflict.

| `seed` | Contents |
|---|---|
| `dev` | One tenant, four users covering every role, the reserved `Uncategorized` category plus four realistic ones, roughly 20 documents across processing states including one FAILED and one password-protected |
| `qa` | The dev set plus the fixtures the acceptance criteria name: `fixture-reporting-01.pdf` for AC-06.01, `kontrak-kerjasama.pdf` with "klausul-kerahasiaan" on page 15 for AC-33.01, a known-duplicate pair for AC-03.01, a 25 MB file for AC-01.06, an EICAR test file for AC-46.02 |

Rate limit: 1 per minute ([01-conventions.md 1.10](01-conventions.md)).

**Output.** `202 Accepted`.

```json
{
  "jobId": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
  "status": "queued",
  "seed": "qa",
  "statusUrl": "/admin/reset-state/d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70"
}
```

**Errors.**

| status | condition |
|---|---|
| 404 | Route not registered. Production, or `ENABLE_RESET_API` false. Indistinguishable from an unknown path. |
| 401 | Missing or wrong `RESET_API_TOKEN` |
| 422 | `confirm` does not equal `reset-<APP_ENV>`, or `seed` is not `dev` or `qa` |
| 409 | A reset is already running |
| 429 | More than one request in a minute |

**Traceability.** [../technical-specs/05-module-definitions.md 5.8.2](../technical-specs/05-module-definitions.md), [../technical-specs/07-security.md 7.6.2](../technical-specs/07-security.md), [../technical-specs/11-environment-configuration.md 11.5](../technical-specs/11-environment-configuration.md).

## 10.5 GET /admin/reset-state/:jobId

**Signature.** `GET /admin/reset-state/{jobId}`

**Purpose.** Progress for a reset. Polled by a QA script waiting to start a suite.

**Access.** `Authorization: Bearer <RESET_API_TOKEN>`. Registered under the same branch as 10.4, so it is equally absent in production.

**Input.** Path parameter `jobId`.

**Behavior.** Reports the current stage and outcome. A completed job's record is kept for one hour, then discarded.

**Output.** `200 OK`.

```json
{
  "jobId": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
  "status": "running",
  "stage": "seed",
  "stages": ["drop", "migrate", "seed", "purge_blobs", "recreate_index", "flush_queue"],
  "startedAt": "2026-09-10T06:12:00.000Z",
  "finishedAt": null,
  "error": null
}
```

`status` is `queued`, `running`, `succeeded` or `failed`. On failure, `stage` names where it stopped and `error` carries the reason. A failed reset leaves the environment in whatever state that stage reached; it is not rolled back, because there is nothing to roll back to. Rerun it.

**Errors.**

| status | condition |
|---|---|
| 404 | Route not registered, or unknown or expired `jobId` |
| 401 | Missing or wrong token |

**Traceability.** [../technical-specs/05-module-definitions.md 5.8.2](../technical-specs/05-module-definitions.md).

## 10.6 What has no endpoint

`GET /metrics` is not in release 1. Metrics leave through the OpenTelemetry OTLP exporter configured by `OTEL_EXPORTER_OTLP_ENDPOINT` ([../technical-specs/11-environment-configuration.md 11.6](../technical-specs/11-environment-configuration.md)), not through a scrape endpoint. Adding one would be a second observability path to keep consistent with the first.

The migration runner has no endpoint either. Migrations run in a one-shot container that exits before `api` and `worker` start ([../technical-specs/02-system-architecture.md 2.4](../technical-specs/02-system-architecture.md)). A migrate-over-HTTP route would let a running process change the schema underneath itself.

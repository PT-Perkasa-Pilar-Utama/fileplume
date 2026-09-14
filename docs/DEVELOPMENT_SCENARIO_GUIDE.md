# Archiva Development Scenario Guide

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Approved  
**Phase:** Release 1  

How work actually gets done here, start to finish. Each scenario is an ordered sequence with runnable commands.

New to the project? Start with [ONBOARDING_GUIDE.md](ONBOARDING_GUIDE.md) and come back here.

## Contents

1. [The work model](#1-the-work-model)
2. [Picking up a card](#2-picking-up-a-card)
3. [Completing a backend card](#3-completing-a-backend-card)
4. [Completing a frontend card](#4-completing-a-frontend-card)
5. [Completing a wiring card](#5-completing-a-wiring-card)
6. [Reviewing a pull request](#6-reviewing-a-pull-request)
7. [Promoting a release](#7-promoting-a-release)
8. [Changing a spec](#8-changing-a-spec)

## 1. The work model

76 cards across 6 sprints, one GitHub issue each, grouped into sprint milestones. Sprint numbers and goals come from [business/sprint-breakdown.md](business/sprint-breakdown.md).

**Issues are unassigned.** You claim one by assigning yourself. The `area:backend`, `area:frontend` and `area:infra` labels indicate the lane, and the card id prefix repeats it.

**Sprint 0 produced a scaffold with the API contract stable.** From Sprint 1 onward, backend and frontend work the same feature in parallel against the contracts in [api-specs/](api-specs/), and a wiring card proves the seam. This is why routes already return contract-valid mocks: the frontend is never blocked waiting for a backend card.

**Review is self-review against [CODE_REVIEW_CHECKLIST.md](CODE_REVIEW_CHECKLIST.md)** until a second reviewer exists. Branch protection requiring one approval could not be enabled on the current GitHub plan, so the one-review rule is convention rather than enforcement. Treat the checklist as the gate it is meant to be.

**Branches:** feature branches target `dev`. `dev` promotes to `test`. `test` releases to `main`. `dev` is the default branch.

## 2. Picking up a card

```bash
# 1. See what is available in your lane.
gh issue list -R PT-Perkasa-Pilar-Utama/fileplume \
  --label area:backend --label sprint:1 --state open

# 2. Read the card. The body carries the AC ids, docs refs and estimate.
gh issue view <number>

# 3. Claim it.
gh issue edit <number> --add-assignee @me
```

Then read, in this order, before writing anything:

1. The acceptance criteria the card cites, in [business/acceptance-criteria-breakdown/](business/acceptance-criteria-breakdown/). These are what you are judged on.
2. The docs sections the card names. Do not re-derive a rule that is already written down.
3. The module you are about to change, and its existing tests.

```bash
git switch dev && git pull
git switch -c be-s2-01-batch-upload    # <card-id-lowercase>-<short-slug>
```

## 3. Completing a backend card

Worked example: `BE-S2-01`, the batch upload endpoint.

### 3.1 Start from the contract, not the code

The endpoint is already specified. Read [api-specs/05-documents.md](api-specs/05-documents.md) 5.2: the request shape, every per-file error code, the response envelope, and the exact Indonesian message for each failure. Your job is to make the stub match a contract that is already written.

### 3.2 Write the test first

One case per acceptance criterion the card cites, and one per typed error the service can return.

```ts
// packages/catalog/src/service.test.ts
test("rejects a file above the tenant limit", async () => {
  // AC-01.06
  const { service } = build({ maxFileSizeMb: 20 });
  const result = await service.upload(fileOf({ sizeBytes: 25 * 1024 * 1024 }));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe("TooLarge");
});
```

Mock at the deepest boundary. The in-memory adapters ship with each module, so no test needs a container:

```ts
const repository = inMemoryTenancyRepository({ quotaBytes: 100 });
const blobStore = inMemoryBlobStore();
```

```bash
bun test packages/catalog          # red, as it should be
```

### 3.3 Implement in the service, not the handler

Replace the `SCAFFOLD` throw in `service.ts`. The handler stays thin: validate, call one service method, map the result.

Layering rules review will check: no business logic in a route handler, no Drizzle outside `repository.ts`, no cross-module internal imports. See [CODING_STANDARD.md](CODING_STANDARD.md) 4.3 to 4.6.

### 3.4 Wire the route

Swap the mock constant for the real service call in `apps/api/src/routes/`, and map each typed error to its code.

### 3.5 Run the gate

```bash
bun run complete-check
bun run scripts/check_module_boundaries.ts
```

### 3.6 Commit and open the PR

```bash
git add -A
git commit    # message format in section 6.3
git push -u origin be-s2-01-batch-upload
gh pr create --base dev --fill
```

The PR template asks for the card id, the AC list, any `SCAFFOLD` left behind, and a self-review attestation. Fill all of it.

### 3.7 Update the tracker

Move the operation from `SCAFFOLD` to `OK` in [api-specs/_index.md](api-specs/_index.md), in the same PR. It is part of the card, not a follow-up.

## 4. Completing a frontend card

Worked example: `FE-S2-01`, the upload tray.

### 4.1 Read the design first

The screen exists in Figma before it exists in code. Open the node the card names ([design/](design/)) and check it against the acceptance criteria. Where the mockup and a criterion disagree on copy, the criterion wins.

### 4.2 Integrate against the mock immediately

The endpoint already returns a contract-valid response, so start now:

```bash
docker compose up -d postgres opensearch valkey minio clamav gotenberg
bun run --filter '@archiva/api' dev     # terminal 1
bun run --filter '@archiva/web' dev     # terminal 2, proxies /api to :3000
```

### 4.3 Take types from the shared package

Do not redeclare a response shape. `packages/shared` holds the Zod contracts both sides use, so a contract change breaks the client at compile time rather than at runtime.

### 4.4 Render server-supplied copy, never client-invented copy

Empty states, error messages, status labels and action labels all arrive from the server. The client renders `meta.message`, `error.message`, `processingLabel` and `actionLabel` as given. This is why an AC string lives in exactly one place.

```ts
// Wrong: a second source for a contract string
if (documents.length === 0) return <Empty>Belum ada dokumen...</Empty>;

// Right
if (documents.length === 0) return <Empty>{meta.message}</Empty>;
```

### 4.5 Put filter state in the URL

TanStack Router search params, so a filtered view is shareable and the back button works.

### 4.6 Gate, commit, PR

Same as 3.5 through 3.7.

## 5. Completing a wiring card

Nine cards own a backend-to-frontend seam. They exist because the integration otherwise belongs to nobody and the criterion is never actually proven.

A wiring card is done when its acceptance criteria pass **against the running stack**, not against a mock. The exit criterion is an end-to-end test.

```bash
docker compose up -d
bun run db:migrate && bun run db:seed:qa    # see Known limitations
bun run test:e2e
```

Worked example, `FE-S5-07`, wiring governance to refusal. One pass must prove all of it:

1. Download succeeds while the category is Active.
2. A Head of Team flips it to Inactive.
3. The very next download attempt is refused with the warning.
4. A direct endpoint call is refused too, not just the button.
5. Both the allowed and the denied rows appear in the Audit Trail with the right labels.

Step 4 is the one that matters. A test asserting a disabled button proves nothing.

## 6. Reviewing a pull request

### 6.1 Walk the checklist, in order

[CODE_REVIEW_CHECKLIST.md](CODE_REVIEW_CHECKLIST.md) is ordered the way you read a PR: scope, layering, types, correctness, security, contract, tests, commits. Section 0 lists what CI already covers; skip those by hand.

```bash
gh pr checkout <number>
bun run complete-check
```

### 6.2 The three that only a human catches

1. A permission asserted in the UI but never at the endpoint.
2. A read-then-decide that looks correct until two requests arrive together.
3. An Indonesian string paraphrased rather than copied.

### 6.3 Commit format

Conventional Commits, imperative, referencing the card and AC ids, with the required trailer:

```
feat(catalog): reject duplicate content on insert

Decided by UNIQUE (tenant_id, content_hash) so the second of two
simultaneous uploads loses on insert rather than on a read-then-check.

Refs: AC-03.01, AC-03.04, BE-S2-03

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. Scope is the module or app.

## 7. Promoting a release

```bash
# dev -> test
gh pr create --base test --head dev --title "promote: dev to test"

# test -> main, then tag
gh pr create --base main --head test --title "release: <version>"
gh release create v0.1.0 --generate-notes
```

Publishing a release triggers the image build. Deployment itself is manual; follow [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) sections 5 and 6. Release notes are grouped by label per `.github/release.yml`.

## 8. Changing a spec

Code follows the specs, so a behaviour change starts there.

| Change | Edit | Then |
|---|---|---|
| New or altered behaviour | `business/` AC, via `/grooming` | Regenerate the AC index |
| Architecture or data model | `technical-specs/` | Update affected api-specs |
| Endpoint contract | `api-specs/` | Update `packages/shared` schemas |
| A rule review enforces | `CODING_STANDARD.md` | Update the checklist item |

```bash
python scripts/build_ac_index.py --business-dir docs/business --write
python scripts/check_index.py --specs-dir docs/technical-specs
python scripts/check_ac_refs.py docs/TASK_BREAKDOWN.md --business-dir docs/business
python scripts/recompute_summary.py docs/TASK_BREAKDOWN.md --write
```

Never restate a rule in a second place. Cite it. Two copies disagree eventually.

## Known limitations

These block some steps above today. Each names what clears it.

| Limitation | Blocks | Cleared by |
|---|---|---|
| Both seeds throw `SCAFFOLD` | `db:seed:*`, so no e2e against real data | `TL-S0-03` |
| No migrations generated | `db:migrate` applies nothing | `TL-S0-02` |
| Only `tenancy` is modelled | Any card needing another table | `TL-S0-02` |
| No acceptance-criterion e2e specs yet; `e2e/` holds only the stack smoke spec | Wiring card exit criteria | Each wiring card writes its own `*.e2e.ts` |
| Branch protection unavailable | The one-review rule is convention | A paid GitHub plan |

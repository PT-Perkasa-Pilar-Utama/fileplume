# Archiva Code Review Checklist

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Approved  
**Phase:** Release 1  

Walk this per PR, in order. Every item is binary: it holds, or it is a finding. Each links to the rule behind it in [CODING_STANDARD.md](CODING_STANDARD.md); there is no item here without a backing rule.

If CI is green, skip section 0. Those items are machine-checked and re-checking them by hand is wasted review.

## 0. Covered by CI, do not re-check by hand

- [ ] `complete-check` and `build` pass (§1.1)
- [ ] No `any` (§2.1)
- [ ] No deep import past a module entry point (§4.1)
- [ ] Formatting matches Biome (§13)
- [ ] A production-configured app 404s the reset endpoint (§8.7)

## 1. Scope

- [ ] The PR does one card's work. Unrelated changes are a separate PR.
- [ ] The description lists every `SCAFFOLD` marker the PR leaves behind (§11.1)
- [ ] Trackers the PR affects are updated in the same PR, not deferred (§12.3)

## 2. Architecture and layering

- [ ] No business logic in a route handler; it validates, calls one service method, maps the result (§4.3)
- [ ] No Drizzle outside `repository.ts`; no OpenSearch query body outside `packages/search` (§4.4)
- [ ] New files sit in the six-part module shape, and their placement is obvious (§4.2)
- [ ] Services receive dependencies through their factory; no singleton, no live client imported into `service.ts` (§4.6)
- [ ] A new adapter lives with the app that composes it; its in-memory counterpart ships with the module (§4.5)
- [ ] No file over 300 lines; anything over 250 was split into `internal/` rather than a `utils` catch-all (§5.1)
- [ ] No rule from the pipeline or search spec is restated; it is cited (§1.2, §12.4)

## 3. Types

- [ ] No non-null assertion; indexed access is handled as possibly undefined (§2.2)
- [ ] Every `as` is one of the three allowlisted cases and carries a reason comment (§2.3)
- [ ] No `as unknown as` anywhere (§2.3)
- [ ] Types derive from the Zod schema rather than being declared twice (§2.4)
- [ ] Exported functions declare a return type (§2.6)
- [ ] Naming matches the table in §3

## 4. Correctness and safety

- [ ] Expected failures return a typed `Result`, not a throw (§6.1)
- [ ] No empty catch, and no catch that logs then continues with a plausible value (§6.3)
- [ ] Error bodies are built by the boundary mapper, never by hand in a handler (§6.2)
- [ ] No read-then-decide over state two requests can race; the database decides (§7.1)
- [ ] Multi-step writes that must be atomic share one transaction (§7.2)
- [ ] Quota is reserved and committed or released, never checked (§7.3)
- [ ] No magic number or string; named constants (§3, §11.2)
- [ ] No dead or commented-out code (§11.2)
- [ ] No `TODO` or `FIXME`; a deferral is a `SCAFFOLD` that names its card and throws (§11.1)

## 5. Security and tenancy

- [ ] Every new route declares a role floor (§8.2)
- [ ] Repository calls pass `TenantId` as a required argument (§8.3)
- [ ] Cross-tenant access returns 404; in-tenant refusal returns 403 (§8.4)
- [ ] Every refusal writes a denied audit event (§8.5)
- [ ] Blob keys are built from ids, never from a filename (§8.6)
- [ ] No `process.env` outside `packages/config` (§9.1)
- [ ] A new env variable touches the schema, `.env.example` and the spec table in one commit (§9.2)
- [ ] No secret added to the repo or an image (§9.3)

## 6. API contract

- [ ] The response matches its `api-specs/` section: envelope, status, field names
- [ ] Indonesian user-facing strings are verbatim from the criterion, not paraphrased (§3.1)
- [ ] A new user-facing message is defined in `ERROR_MESSAGES`, not inline (§6.4)
- [ ] Empty results return 200 with the right `meta.message`, not an error
- [ ] A contract change is reflected in `api-specs/` in the same PR (§12.3)

## 7. Tests

- [ ] One test per acceptance criterion the card cites, and the test names the id (§10.1, §10.4)
- [ ] One test per typed error the service can return (§10.1)
- [ ] Permission refusals asserted through the endpoint, not by checking a disabled control (§8.1, §10.1)
- [ ] Cross-tenant read paths asserted to 404 (§10.1)
- [ ] Mocks sit at the repository or port, never at an intermediate layer, never on the subject (§10.2)
- [ ] Test names state behaviour, not the function under test (§10.3)
- [ ] Database tests run against real PostgreSQL with real migrations (§10.5)

## 8. Comments and commits

- [ ] Comments explain why and cite the spec section or criterion; none narrate what the code does (§12.1)
- [ ] Commits are Conventional, imperative, and reference the card and AC ids (§12.2)
- [ ] Every commit carries the `Co-Authored-By` trailer (§12.2)

## Reviewer note

A finding is a finding regardless of how small the diff is. The three that most often slip through on this codebase, because nothing but a human catches them:

1. A permission asserted in the UI but never at the endpoint (§8.1).
2. A read-then-decide that looks correct until two requests arrive together (§7.1).
3. An Indonesian string paraphrased rather than copied, which passes review and fails the acceptance test (§3.1).

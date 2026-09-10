---
name: Feature card
about: A card from docs/TASK_BREAKDOWN.md
title: "<CARD-ID> <title>"
labels: type:feature
assignees: ''
---

## Task description

<!-- From the card. What is built, and the rule it must honour. -->

## Acceptance criteria

<!-- Every AC id this card satisfies. Bodies in docs/business/acceptance-criteria-breakdown/. -->

- AC-

## Docs

<!-- The authoritative sections. Read before starting; do not re-derive a written rule. -->

- `docs/api-specs/`
- `docs/technical-specs/`

## Estimate

<!-- Developer-days from the card. -->

## Definition of done

- [ ] Every cited AC passes against a running server, not a mock
- [ ] Indonesian strings match the criterion verbatim
- [ ] The server refuses what the UI hides, asserted at the endpoint
- [ ] Tenant scope proven with a cross-tenant 404 test
- [ ] The audit row exists where a criterion names one
- [ ] `bun run complete-check` passes
- [ ] `docs/api-specs/_index.md` tracker updated for any operation completed

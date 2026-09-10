## Card

<!-- The Card ID from docs/TASK_BREAKDOWN.md, e.g. BE-S2-01. One card per PR. -->

Card:
Closes #

## Acceptance criteria covered

<!-- Every AC id this PR proves, from docs/business/. Each one needs a test. -->

- AC-

## Target branch

<!-- Feature branches target dev. dev promotes to test. test releases to main. -->

- [ ] `dev`
- [ ] `test`
- [ ] `main`

## What and why

<!-- What changed, and the reason. Not a restatement of the diff. -->

## How to test

<!-- Exact commands or steps a reviewer runs to see it work. -->

```bash
bun run complete-check
```

## Deferred work

<!-- List every SCAFFOLD marker this PR leaves behind, with the card that closes it.
     Write "none" if there are none. TODO and FIXME are not permitted. -->

none

## Self-review

I have walked [docs/CODE_REVIEW_CHECKLIST.md](../docs/CODE_REVIEW_CHECKLIST.md) against this diff.

- [ ] `bun run complete-check` passes locally
- [ ] Every cited AC has a test that names its id
- [ ] Permission refusals are asserted through the endpoint, not by checking a disabled control
- [ ] Cross-tenant access is asserted to 404
- [ ] Indonesian strings are verbatim from the criterion
- [ ] No `TODO` or `FIXME`; deferrals are `SCAFFOLD` and listed above
- [ ] Trackers this PR affects are updated in this PR

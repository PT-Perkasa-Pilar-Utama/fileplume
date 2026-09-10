# Design

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Reference  
**Phase:** Release 1  

The visual source of truth for the Archiva interface.

## Figma

| Item | Value |
|---|---|
| File | [Archiva](https://www.figma.com/design/TU0ZpjSwDyrIJxBjzwHcZk/Archiva) |
| Entry node | [node-id 1-670](https://www.figma.com/design/TU0ZpjSwDyrIJxBjzwHcZk/Archiva?node-id=1-670&p=f&t=ICtiKeAfNQ7Jrglf-0) |
| Access | Request from the Tech Lead |

## How the design relates to the rest of the docs

The Figma file governs layout, spacing, colour and component appearance. It does not govern behaviour or copy.

| Concern | Owned by |
|---|---|
| Layout, spacing, colour, typography, component states | Figma |
| What a screen must do | [../business/](../business/) acceptance criteria |
| Every user-facing string | The acceptance criterion, quoted verbatim |
| Which fields a screen receives | [../api-specs/](../api-specs/) |
| Which menus a role sees | [../technical-specs/09-authentication-authorization.md](../technical-specs/09-authentication-authorization.md) 9.3.3 |

Where Figma and an acceptance criterion disagree on copy, **the criterion wins**. Interface strings are Indonesian and quoted verbatim from the AC; a designer's paraphrase in a mockup is not the contract. Raise the difference via `/grooming` rather than shipping either version silently.

Where Figma and the api-specs disagree on which data a screen shows, the api-specs win, because the endpoint decides what exists.

## Implementation notes

Components are shadcn/ui primitives under `apps/web/src/components/ui/`, themed with Tailwind 4. Dark mode is a class toggle on the shadcn theme layer, per US-36.

A frontend card cites the Figma node it implements in its PR description, so a reviewer can compare the built screen against the intended one.

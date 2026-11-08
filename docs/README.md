# Docs index

Read in order on a first pass; the ADRs and learning notes are reference material. These docs
are normative. Package-level documents live at the repository root: `README.md` (install,
quickstart, privacy summary), `SECURITY.md`, `CHANGELOG.md` and `THIRD_PARTY.md`.

| # | Doc | Kind |
|---|---|---|
| 00 | [Vision](00-vision.md) | why / for whom |
| 01 | [MVP scope](01-scope-mvp.md) | behaviour, with acceptance criteria |
| 02 | [Architecture](02-architecture.md) | packages, data flow, boundaries |
| 03 | [Runtime instrumentation](03-instrumentation.md) | the Svelte-internals layer |
| 04 | [Element inspection](04-element-inspection.md) | node → payload rules |
| 05 | [Prompt format](05-prompt-format.md) | the clipboard document |
| 06 | [Toolbar UX](06-toolbar-ux.md) | the overlay, interaction, a11y |
| 07 | [Delivery](07-delivery.md) | virtual modules, SvelteKit injection, base |
| 08 | [Testing](08-testing.md) | layers, matrix, coverage, flakiness |
| 09 | [Security & privacy](09-security-and-privacy.md) | what may leave the page |
| 10 | [Risks](10-risks.md) | coupling, perf, pivots |
| 11 | [Roadmap](11-roadmap.md) | M0–M5, v2 candidates |

## Specs

- [Payload schema](specs/payload-schema.md) — the `__SPHERE__` contract and its invariants.
- [Location resolution](specs/location-resolution.md) — verified / matched / enclosing, with the test matrix.
- [Event matrix](specs/event-matrix.md) — what picking swallows, exactly.
- [Clipboard example](specs/clipboard-example.md) — three real payloads in the v1 format (golden shape).

## Decisions (ADRs)

1. [0001 — Independent project](decisions/0001-independent-project.md)
2. [0002 — Opt-in, generated instrumentation](decisions/0002-opt-in-instrumentation.md)
3. [0003 — No global shortcut](decisions/0003-no-global-shortcut.md)
4. [0004 — Clipboard only](decisions/0004-clipboard-only.md)
5. [0005 — Snippet labelling](decisions/0005-snippet-labelling.md)
6. [0006 — Single package](decisions/0006-single-package.md)
7. [0007 — Overlay in Svelte](decisions/0007-overlay-in-svelte.md)
8. [0008 — Package name](decisions/0008-package-name.md) *(superseded by 0009)*
9. [0009 — SPHERE, the acronym, and `sphere-plugin`](decisions/0009-name-and-package.md)

## Learning (facts about the platform, with evidence)

- [Svelte 5 dev runtime](learning/svelte-internals.md) — `__svelte_meta`, dev stack, hydration assignment, signals, snippets.
- [SvelteKit + Vite dev server](learning/sveltekit-vite-dev-server.md) — `transformIndexHtml` bypass, virtual-module URLs, `base` + `/@fs`, one-server rule.
- [Dev overlay lessons](learning/ui-overlay-lessons.md) — shadow DOM inheritance, cursor, event chain, focus, marks, a11y.
- [Vitest + Svelte harness](learning/vitest-svelte-harness.md) — client transforms in Vitest 5, the `browser` condition, `unmount`, `__svelte_meta`.

## Status of these documents

The docs are normative. Specs state behaviour as rules (MUST/MUST NOT/SHOULD) with the test that
proves them; ADRs record decisions and are superseded rather than rewritten; `learning/` notes cite
the file and function they come from. When code and a spec disagree, fix one of them in the same
change.

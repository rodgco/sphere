# 0001 — Sphere is an independent project

## Context

The feature was first written as a pull request to a general-purpose devtools suite. The work was
complete and tested, but that project owns the component-tracking runtime, the dev-server delivery,
the panel UI and a release train, and a feature of this size has to satisfy a scope and maintenance
bar set for the whole suite. The review was positive about the idea and demanding about the
implementation, which is a fit signal, not a rejection — but the dependency direction is awkward: a
prompt builder needs a *small* runtime, while the suite needs a *large* one. This record deliberately
does not name that suite: the decision is about direction, not about a specific project.

## Decision

Build Sphere as an independent, single-purpose package with its own instrumentation layer. Take no
dependency on the suite, keep the behaviours that proved themselves and re-derive the rest from
Svelte's own source (`docs/learning/`), and contribute nothing upstream for now; if the approach
proves useful, revisit with an ADR.

## Consequences

- Sphere carries the Svelte-internals coupling itself (`docs/10-risks.md` §1) and must keep up with
  Svelte minors.
- It can choose its own delivery, UI framework, release cadence and options without negotiating a
  suite's compatibility.
- Users who already run a devtools suite or `vite-plugin-svelte`'s inspector can run Sphere next to
  them; nothing conflicts (different module ids, no global names beyond `__SPHERE__`).
- Package naming (`sphere`, `svelte-sphere`, `@scope/sphere`) is decided at M0; the architecture does
  not depend on it.

## Alternatives considered

- **Keep the PR open and wait.** Blocks the product on someone else’s priorities; the review round
  already showed the size gap.
- **Extend `vite-plugin-svelte`’s inspector.** They already ship an overlay, but props/`$state` need
  runtime instrumentation inside the Svelte team's own plugin — an even higher bar, and the same
  suite-coupling problem. Contribute the reusable pieces (bug repro, injection fix) separately
  instead.
- **Depend on that suite as a peer.** Would let Sphere stay thin, but ties its install base and
  versioning to the suite and exposes the whole runtime for a fraction of it.

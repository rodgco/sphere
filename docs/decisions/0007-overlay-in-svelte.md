# 0007 — The overlay is written in Svelte, compiled by the host

## Context

The prototype's overlay is 1 079 lines of hand-written DOM (no framework) because it was served as a
`?raw` string from a package that could not assume a Svelte compilation step. That works, but every
UI change is DOM plumbing, and the code cannot use the ecosystem's ergonomics (reactivity, slots,
transitions) that its target users already know.

## Decision

Write the overlay as Svelte components under `src/overlay/`, served as **virtual modules pointing at
real source files** so the host project's Svelte plugin compiles them. No bundler in this repository,
no duplicated Svelte runtime. `svelte` is a peer dependency.

## Consequences

- The overlay is typechecked with `svelte-check` and reviewed in a language the users know.
- The package ships `.svelte`/`.ts` sources (see ADR 0006) and must be transparent about it.
- The overlay inherits the host's Svelte version; Sphere's supported range must match the host's
  (`svelte >= 5.x`), which it already does for the instrumentation.
- Virtual-module delivery must work on plain Vite and SvelteKit (it does — the same pattern
  `vite-plugin-svelte`'s inspector uses).

## Alternatives considered

- **Keep vanilla DOM**: no host coupling, but unmaintainable for a UI this size.
- **Pre-built overlay bundle**: duplicates the runtime, complicates CSP (inline script) and loses
  typechecking.

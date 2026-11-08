# 0002 — The instrumentation is opt-in and generated, not branched

## Context

The instrumentation wraps `svelte/internal/client` for every module in the app. A review of an
earlier implementation caught the important mistake: the element stamps ran even when the feature
was disabled, adding a DOM walk per rendered fragment and retaining props for every instance. A runtime
`if (enabled)` inside the wrapper would still pay for the branch, keep the code in the module, and
leave the behaviour “almost” inert.

## Decision

The served client module is **generated**: the tracking wrapper always, plus the element-stamp file
appended only when the option is enabled. With Sphere off the module is byte-identical to upstream
(pinned by a test), `push()` calls a null hook, and no DOM is walked.

No option is read at runtime inside the wrapper; the decision is made when the module is built for
that dev server.

## Consequences

- “Off” is provably free: `wrapperModule(false) === wrapperCode`, plus perf evidence
  (`docs/10-risks.md` §3).
- Enabling the option requires a dev-server restart (the module is generated per server). Documented
  and expected.
- The two variants must both be tested (module contract + runtime harness), and the appended file
  only sees the wrapper's module scope — no `import` of its own.

## Alternatives considered

- **Runtime flag** (`if (options.promptToolbar)` in every wrapper): cheaper to implement, leaves
  instrumentation in the module and a branch in the hot path; rejected by review.
- **Separate plugin instance** (`sphere()` replacing the module only when present): forces users to
  add/remove a plugin to toggle a UI preference; worse ergonomics for the same result.

# 0011 — No page-global inspection API

## Context

The runtime installed `window.__SPHERE__` with `inspectElement` and `locateElement` at import time.
Any same-page script could call it without a user gesture and read every component's props and
state; on localhost that includes browser extensions, forgotten analytics snippets and the host
project's own dependencies. The audit (`docs/12` §4.5) rated this Medium because the overlay itself
only copies after a gesture, while the global did not. Gating the global behind an active overlay
and a nonce does not stop a same-origin script, which can read the nonce too.

## Decision

Do not expose the inspection API on `window`. The instrumentation wires its accessors through
`installInspector()`, and the overlay imports `inspectElement`/`locateElement` from
`src/runtime/inspect.ts` like any other module. There is no page global, enumerable or otherwise.

This supersedes the “runtime global: `window.__SPHERE__`” line in
[0009](0009-name-and-package.md); the package name and plugin factory are unchanged.

## Consequences

- A same-page script can still read the DOM and the app's own data, but it cannot use Sphere's
  component registry as a shortcut to props and state.
- Tests and the harness import the functions directly; the payload schema describes a module
  contract, not a global.
- `docs/02`, `docs/07`, `docs/11` and the payload schema no longer advertise a global. The HMR
  mount guard is the host element, not the API.
- A future public API, if needed, gets an explicit opt-in and an allowed-origin story of its own.

## Alternatives

- **Gate on picking and a nonce.** Rejected: the nonce lives in the same page and is readable by the
  same scripts; it adds complexity without a boundary.
- **Keep the global for tools.** Rejected for v1: the overlay is the only consumer, and the cost of
  a public page surface is higher than the benefit.

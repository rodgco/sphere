# 10 — Risks

The honest list. Each risk has a signal to watch and a response already decided.

## 1. Svelte internals coupling (highest)

**What**: the instrumentation wraps `svelte/internal/client` (`push`, `pop`, `tag`,
`tag_proxy`, block helpers, `add_locations`, `add_svelte_meta`). None of that is public API.

**Likelihood**: certain over time — every minor release may rename or restructure something.

**Impact**: wrong attribution (prompt blames the wrong component) or a broken wrapper (app
breaks) — the second is unacceptable, the first is a release blocker.

**Response**:
- The wrapper always calls through and never lets its own errors escape (app safety first).
- Startup assertion: every wrapped function must exist, else serve upstream's module unchanged
  and log one warning.
- A version matrix in CI (two previous Svelte minors) fails loudly.
- A pinned, documented supported range; a new Svelte minor is a supported-version bump, not a
  silent auto-update.
- Escape hatch: `sphere({ instrumentation: false })` keeps the overlay (element location,
  template context, markup, DOM path) without touching the client module.

## 2. Element metadata can be approximate

**What**: Svelte assigns locations positionally; during hydration a child component's markup can
shift the mapping (`docs/learning/svelte-internals.md` §3).

**Response**: the conservative matcher (`docs/specs/location-resolution.md`), the `~` marker, the
note in the prompt, and an e2e case that proves the label. If Svelte ever fixes the assignment,
the matcher becomes a no-op.

## 3. Perf inside a pointer handler

**What**: inspecting an element reads DOM metadata, walks the instance tree and clones values —
all inside `pointerdown`.

**Response**: hard budgets shared per inspection; no `textContent`/`outerHTML`; a benchmark that
measures the *instrumentation* on/off and a benchmark that measures `inspectElement` on the
largest fixture (`docs/08-testing.md` §7). A regression over the declared budget is a blocker.

## 4. Scope creep into a devtools product

**What**: once the overlay exists, panels, graphs and profilers are tempting.

**Response**: the vision doc's non-goals; anything beyond "pick → describe → copy" needs an ADR.
The v2 candidate (an agent-facing surface) is deliberate and separate.

## 5. Clipboard as the only output

**What**: some users want "send to my agent" directly; the clipboard is a manual step.

**Response**: v1 stays clipboard-only (no network, no accounts, no editor integration). If the
demand is real, v2 adds an opt-in local mechanism, not a cloud one.

## 6. Overlay in someone else's page

**What**: the overlay is a guest: shadow DOM boundaries, inherited properties (`cursor`,
`pointer-events`, `font`), z-index fights, pages that swallow events themselves.

**Response**: the isolation rules in `docs/06-toolbar-ux.md` §7, the event matrix, and a fixture
suite of hostile pages (fixed headers, full-screen canvas, `pointer-events: none` ancestors) in
the e2e suite.

## 7. Accessibility regressions

**What**: custom hover/pick interactions are easy to make keyboard- and screen-reader-hostile.

**Response**: the baseline in `docs/06-toolbar-ux.md` §8 is a release criterion, and
`e2e/a11y.mjs` checks the parts a browser can observe (labels, roles, focus order, the focus ring).
A manual pass is not a substitute for axe; running it is still on the list.

## 8. Distribution and trust

**What**: a dev-only package that reads project files and copies content is a supply-chain
target.

**Response**: no runtime dependencies if avoidable, published with provenance, source-mapped,
and a `SECURITY.md`. Dev-only means users can also vendor it.

## 9. Naming and discoverability

**What**: `sphere` is a crowded name; an unscoped package may be taken.

**Response**: decide at M0 (`docs/decisions/0001-independent-project.md`); the package name is
not load-bearing for the architecture.

## 10. What would make us pivot

- Svelte ships an official dev API exposing instances/props/state → we drop the wrapper and keep
  the format + overlay (smaller, more durable package).
- An official "context for agents" surface appears in SvelteKit/DevTools → Sphere becomes a
  formatter/adapter rather than a plugin.
- Users overwhelmingly want direct agent delivery over the clipboard → the output layer changes,
  the inspection layer does not.

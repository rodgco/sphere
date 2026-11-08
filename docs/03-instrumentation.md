# 03 — Runtime instrumentation

This is the part that makes the prompt trustworthy: knowing **which component instance**
rendered a node, and what its props and state are *now*. It is also the only part that couples
Sphere to Svelte internals, so the design is deliberately conservative.

## What we need, and where it comes from

| Need | Source | Notes |
|---|---|---|
| Component instance id, file, parent | wrap `push`/`pop` of `svelte/internal/client` | `push(props, runes, fn)`; `fn[FILENAME]` gives the file |
| Which instance rendered a DOM node | stamp elements when the compiler's `add_locations(fn, file, locations)` wrapper runs | stamp = `__svelte_meta.dtComponentId` |
| Where an instance's tag lives in its parent | wrap `add_svelte_meta(cb, type, component, line, column, extra)` | parallel frame stack; `componentTag` for component frames |
| Props | the `props` argument of `push` | props are getters → values are *current*, not "at mount" |
| `$state`/`$derived` per instance | wrap `tag`/`tag_proxy` (Svelte dev mode emits them) | named signals; `derived` may be unevaluated |
| Mutation detection for objects | signal write version (`wv`) + periodic re-read | proxies mutate in place |
| Owner attribution for later renders | block helpers (`each`, `if`, `key`, `await`, `component`, `boundary`) + `active_effect.ctx` | blocks render after the creating component's init |

Everything else (element location, template context) comes from Svelte's own metadata — see
`docs/04-element-inspection.md`.

## How it is installed

The plugin serves the module that app code imports as `svelte/internal/client`:

```ts
// plugin/compile.ts (sketch)
const wrapper = promptToolbarEnabled
  ? `${trackingWrapper}\n${elementStamps}`   // two source files, concatenated in one module
  : trackingWrapper                          // upstream client + lifecycle/tag overrides only
```

- The wrapper re-exports `*` from the real module and overrides a fixed set of functions.
  The set is asserted by a test (`overrides exactly these exports`), so an upstream change
  that adds/removes an export fails loudly.
- The element-stamp file is **appended only when enabled**: with Sphere off, `push()` does not
  call any hook and no DOM walk happens (see the ADR).
- No runtime `if` in a hot path decides whether to instrument; the decision is made when the
  module is generated.

## Rules the instrumentation must obey

1. **Call through, always.** Every wrapper calls the original with the original `this` and
   arguments, and returns its value; side effects run in `try/catch` so a Sphere bug cannot
   break the app.
2. **Never retain state longer than the instance lives.** Props are held per instance and
   released in `unmount`; a WeakMap keyed by component context is used where possible.
3. **Stamp only what Svelte located.** The stamp walk starts at the node Svelte was given and
   walks siblings, one per entry in the compiler's location list (this is what makes multi-root
   templates work during hydration). No global `querySelectorAll`.
4. **Bound the walk.** Total visited nodes per `add_locations` call is capped (20 000 in the
   prototype); exceeding the cap stops the stamp instead of stalling the frame.
5. **Attribute correctly under snippets.** Markup passed to another component as a snippet
   renders inside the host, but belongs to the component that wrote it. Svelte distinguishes
   ownership (`wrap_snippet` swaps the dev component function) from the DOM tree. Sphere
   reports the *rendered* chain and labels which instance defines the markup; it does not
   reorder the tree (`docs/04-element-inspection.md` §4).
6. **Degrade, don't guess.** If the runtime is missing (tracking disabled, module replaced by
   another plugin), `inspectElement` returns the element-only payload and the overlay says
   state and chain are unavailable.

## Budgets (per inspection)

One click is one inspection; the budget is shared by everything it reports:

| Budget | Value | Why |
|---|---|---|
| Cloned nodes | 2 000 | a page can hold megabytes of state |
| Characters of serialised values | 20 000 | bounds the payload, not just the prompt |
| Depth of a cloned value | 4 | enough for `data.user.role` |
| Entries per object/array | 25 | enough to show shape |
| String length inside a value | 320 | ids, labels, messages |
| Chain depth | 32 | component trees are shallow |
| State nodes per instance | 40 | ranking by name order, not importance |

The formatter then summarises — see `docs/04-element-inspection.md` §5 — so the prompt is far
smaller than the payload budget.

## Compatibility and failure modes

- On startup, the wrapper asserts that every function it intends to wrap exists and is a
  function; otherwise it logs one warning and serves upstream's module unchanged (a broken
  Sphere must not break the app).
- `svelte/internal/client` is not a public API. Sphere pins the supported Svelte range and runs
  a matrix in CI (`docs/08-testing.md` §6). Discovering a change at release time is expected;
  silently mis-attributing is not.
- Hydration is the fragile path: element metadata is assigned positionally, so the
  instrumentation is tested in a real browser (`docs/learning/svelte-internals.md` §3).

## What we will not do

- Patch the Svelte compiler output with regexes (the prototype avoided this by wrapping the
  module boundary instead and it is the reason the approach survives minor releases).
- Read `component_context` internals that are not exported; if a piece is missing, propose an
  upstream API instead of reaching further in.
- Store anything about the app in Postgres/localStorage/telemetry. The only persisted state is
  UI preference (panel open, options, control position).

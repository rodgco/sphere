# Svelte 5 dev runtime — verified notes

Everything here was verified against **Svelte 5.57** (dev compile) while building the prototype.
Paths are relative to the `svelte` package. Anything marked *(unverified)* was inferred, not
observed.

## 1. Element metadata

Compiled dev output wraps element creation:

```js
var root_1 = $.add_locations($.from_html(`<div>…</div>`), App[$.FILENAME], [
  [43, 0, [[46, 2, [[47, 4, …]]], [66, 4, …], [95, 4, …]]],
])
```

- `add_locations(fn, filename, locations)` returns a function; each call clones the template and
  then assigns metadata (`svelte/src/internal/client/dev/elements.js`).
- `locations` mirrors the markup tree: `[line, column, nested?]`, one entry per element **the
  compiler tracks**, including nested children.
- Assignment walks **siblings**: start at `dom` (or `dom.firstChild` for a fragment; during
  hydration, the existing first node) and consume one entry per `ELEMENT_NODE`, recursing into
  `location[2]` from `element.firstChild`.
- Result: `element.__svelte_meta = { loc: { file, line, column }, parent: devStack }` — `line` is
  1-based, `column` 0-based.

## 2. Dev stack (`__svelte_meta.parent`)

`add_svelte_meta(callback, type, component, line, column, additional)` pushes a frame and runs the
callback (`svelte/src/internal/client/context.js`):

```js
dev_stack = { type, file: component[FILENAME], line, column, parent: dev_stack, ...additional }
```

- `type` values observed in compiler output: `component`, `if`, `each`, `await`, `key`, `render`,
  `snippet`, `boundary`.
- `component` frames carry `componentTag` (the tag name as written).
- Elements created inside the callback inherit the current stack, so `__svelte_meta.parent` gives
  the enclosing tags/blocks — this is how a prompt can say “inside `{#each}` in `Todos.svelte:14`”.
- `dev_stack` itself is **not exported**; a wrapper must mirror it (a module-level array pushed in
  the `add_svelte_meta` override).

## 3. Hydration assigns locations positionally (the important bug/limits)

During hydration `add_locations` is called with the **first existing node**, not a fragment, and
`assign_locations` walks `node.nextSibling` from there, consuming the compiler's list in order.

Consequences observed in a SvelteKit app (`AuthShell.svelte`):

| Element in the source | What `__svelte_meta.loc` said |
|---|---|
| `<div class="auth-pitch">` (line 25) | line 33 — the line of the **next** sibling |
| `<p class="auth-footnote">` (line 33) | *no metadata at all* |
| `<p class="eyebrow">` inside `auth-card` (line 43) | correct |

Interpretation: an element rendered by a **child component** inside the listed range (here
`<Brand />`'s `<a>`) occupies a slot in the sibling walk, so every following entry shifts by one
and the last one falls off the list. On a client-side mount the same page is correct — which is why
this is invisible in a jsdom/mount harness.

Rules we derived:

1. Never trust `loc` blindly; verify it against the element's markup.
2. When stamping instances, mirror the sibling walk (one root per location entry) or multi-root
   templates lose every root after the first during hydration.
3. Test hydration in a **real browser**; a vitest module graph compiles for one target only.

## 4. Component lifecycle surface

- `push(props, runes, fn)` — `fn` is the component function; `fn[FILENAME]` gives its file.
- `pop(component)` — returns the component's exports; user effects created during init are
  created here (deferred to mount).
- `component_context` (`ctx`) is not exported, but `active_effect.ctx` is the component context an
  effect belongs to; a `WeakMap<ctx, id>` filled on mount lets you attribute work done outside
  `push`/`pop` (effects, later block renders).
- `active_effect` is exported, which is the hook that makes block attribution possible.

## 5. Signals in dev mode

- The compiler wraps `$state`/`$derived` in `$.tag(signal, 'name')` (and objects in
  `$.tag_proxy(value, 'name')`), which is how names and values can be reported without touching
  internals: the signal object itself has `.v` (value), `.wv` (write version), `.deps`,
  `.reactions`, and `_isProxy` for proxies.
- A `$derived` is **lazy**: until read, `.v` is the `UNINITIALIZED` symbol. A devtools must show
  “not evaluated yet”, not a bogus value.
- Proxy state mutates in place: reassignment bumps `.wv`, deep mutation does not — polling must
  re-read objects periodically to notice (`_stateSnapshots` in the prototype).
- Functions and symbols are not state data; skip them rather than serialising.

## 6. Blocks, snippets and ownership

- Block helpers (`each`, `if`, `key`, `await`, `component`, `boundary`) are called during the
  owner's init, but their callbacks run later, when the wrapper stack is empty. Wrapping the
  helpers and re-pushing the owner id around every function argument restores attribution.
- `snippet(node, getSnippet, ...args)` and `wrap_snippet(component, fn)` exist for `{#snippet}` /
  `{@render}`; `wrap_snippet` sets `dev_current_component_function` to the **defining** component
  (for ownership checks).
- **The DOM is still attributed to the rendering component**: a `<a>` passed as `children` to
  `Wrapper` and rendered via `{@render children()}` lives inside `Wrapper`'s tree. Svelte reports the
  renderer. Rewriting the tree to the definer breaks the mental model of every devtools panel, so
  the prototype keeps the tree and labels both entries (`renders the markup` / `defines the
  markup`) — see `docs/decisions/0005-snippet-labelling.md`.

## 7. Props

- `push`'s first argument is `$$props`, an object whose properties are **getters**; reading it
  later returns the current values. “props at mount” is therefore a mislabel, not a snapshot.
- `$$slots` shows up as a prop in dev builds; it is plumbing, not data.

## 8. The export surface to wrap

The prototype's wrapper overrides exactly (asserted by a test that diffs against
`svelte/internal/client`):

```
pop, push,
state, derived, proxy, tag, tag_proxy,
user_effect, user_pre_effect,
template_effect, deferred_template_effect,
each, if, key, await, component, boundary
```

and, only when element inspection is on, additionally:

```
add_locations, add_svelte_meta
```

`FILENAME`, `active_effect`, `UNINITIALIZED` are read from the same module but not replaced.

## 9. What is not exported (and must be mirrored)

- `dev_stack` — mirror it in the `add_svelte_meta` override.
- `hydrating` — not needed if the stamp walk mirrors the sibling traversal instead of assuming a
  fragment.
- `component_context` — use `active_effect.ctx` + a WeakMap, or catch the instance in `push`.

## 10. Versioning risk

None of the above is public API. Before each supported Svelte minor: run the runtime harness, the
browser e2e and the `overrides exactly` test; on failure, either adapt or drop the supported-range
ceiling — never ship silently wrong attribution.

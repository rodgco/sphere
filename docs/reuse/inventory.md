# Reuse inventory — the prototype

The working implementation lives in a private fork of `vite-devtools-svelte`
(`packages/vite-devtools-svelte/` inside another project). This is what exists, what it is worth,
and what Sphere should do with it. Line counts are from the prototype for sizing, not a target.

## 1. Files

| Prototype file | Lines | What it does | Sphere |
|---|---|---|---|
| `src/runtime/client.js` *(only our additions)* | ~340 of 2 224 | `inspectElement`, `locateElement`, bounded value cloning, element info + markup skeleton, instance props/frame maps | **Port and adapt** — split into `inspect.ts`, `budgets.ts`, `element.ts` |
| `src/runtime/wrapper-toolbar.js` | 108 | element stamps (`dtComponentId`), dev frame stack, `add_svelte_meta`/`add_locations` overrides, instance-context hook | **Port** — becomes `instrumentation/elements.ts` |
| `src/runtime/wrapper.js` *(baseline, not ours)* | 390 | component lifecycle, signal tagging, effect/render tracking, block attribution | **Reimplement minimal** — Sphere needs `push`/`pop`/`tag`/`tag_proxy`/blocks, not the whole devtools wrapper |
| `src/runtime/prompt-format.ts` | 663 | location resolution, value summaries, markdown formatting, prompt assembly | **Port** (it is already typed, pure and unit-tested) |
| `src/runtime/prompt-toolbar.js` | 1 079 | shadow-DOM overlay: control, drag, picking, marks, panel, storage | **Rewrite in Svelte components**; keep the behaviours and the event matrix |
| `src/server/toolbar.ts` | 45 | URL/tag helpers + config-in-module | **Replace** by virtual modules (`docs/07-delivery.md`) |
| `src/plugin.ts` *(toolbar wiring)* | ~60 of 408 | option, virtual ids, injection, config | **Port the ideas**, new structure |
| `src/runtime/ids.ts` | 3 ids | module ids | **Port** |
| `test/prompt-toolbar.test.ts` | 669 | location matrix, formatting, summaries, option toggles | **Port** almost verbatim |
| `test/toolbar.test.ts` | 65 | URL/tag/module config | **Adapt** to virtual modules |
| `test/reactivity/inspect.test.ts` | 184 | real components → payload (single root, multi-root, props, state, big values) | **Port** as the runtime harness |
| `e2e/prompt-toolbar.mjs` | 433 | pick swallowing, location honesty, base path | **Port** and split per concern |
| `scripts/screenshots/prompt-toolbar.mjs` | 344 | dark/light capture + privacy scan + manifest | **Port** |
| fixture apps | — | sample app with `SVELTE_DEVTOOLS_PROMPT_TOOLBAR=1` + base-path profile | **Recreate** as Sphere fixtures |

## 2. Behaviour inventory (what “working” means today)

- [x] Opt-in; zero-cost when off (served wrapper module identical to upstream, asserted by a test)
- [x] Control: draggable, remembered position, double-click reset, keyboard toggle, `aria-pressed`
- [x] Picking: hover outline + tooltip with `element` and `file:line` (with `~`), one cursor for
      the page, primary-button-only swallowing of the full event chain
- [x] Multi-select with numbered outlines that follow scroll/resize/mutations and are clipped by
      scrollable ancestors; unpick by clicking again; cap with a message
- [x] Panel: entries with remove, instructions (kept across open/close), four option toggles
      (persisted), Copy prompt, Clear (resets text too), status line (`aria-live`), theme
      (`prefers-color-scheme`), dialog semantics and labels
- [x] Payload: element identity without text or `svelte-xxxx`, markup skeleton, verified/matched/
      enclosing locations with notes, template frames (project files only), instance chain with
      props and live `$state`/`$derived` (bounded, valid JSON), snippet labelling
- [x] Prompt: page + instructions + per-selection blocks, source window with the reported line
      marked, values inlined while they fit, node_modules filtered, 60 000-char cap
- [x] Source reads through `/@fs` with base support, cached per file
- [x] Tests: 1 281 unit/harness tests, coverage 98.6/95.0/98.7/99.5, browser e2e (3 scripts’
      worth of cases), screenshots with privacy scan, CI jobs for both

## 3. What to port as-is (high confidence)

- `prompt-format.ts` and its test suite — the formatting rules are the product’s voice; they are
  pure and already boundary-tested.
- `wrapper-toolbar.js` semantics: stamping traversal (sibling walk bounded by the compiler’s
  location list), dev frame stack, instance context hook.
- The location resolution algorithm and its test matrix.
- The e2e cases and the screenshot script (including the privacy patterns).
- The budget constants, after re-measuring.

## 4. What to rewrite

- **Overlay**: vanilla DOM (1 079 lines) → Svelte components compiled by the host plugin. Keep the
  CSS tokens, the interaction rules and the event matrix; drop the hand-rolled DOM plumbing.
- **Delivery**: static file + middleware + `?raw` strings → virtual modules serving real sources.
- **Instrumentation**: the prototype depends on the devtools wrapper’s whole tracking surface. Sphere
  needs a smaller wrapper (lifecycle + tags + blocks + element stamps), which is less code and less
  risk; do not inherit panel-oriented features (render profiling, state timeline).
- **Package shape**: fork of a devtools package → single-purpose package with one option object.

## 5. What to drop

- The custom HTTP middleware (replaced by virtual modules).
- Dual-mode delivery for the DevTools dock (not our problem).
- The `version` query param / cache-busting (Vite handles freshness).
- Render profiling, FPS, MCP, state timeline, any panel other than the prompt one.

## 6. Open questions to settle while porting

1. How much of `client.js` does Sphere need? Target: ≤ 400 lines for inspection, not 2 200.
2. Do we keep the *whole* payload JSON text (string) or return structured values and let the
   formatter stringify? (The prototype returns JSON text because it crossed a window boundary;
   within one module we can return objects and keep the invariant by test.)
3. Does the overlay compile from `.svelte` in the published package, or do we build it to JS at
   publish time? (Preference: ship sources, like `vite-plugin-svelte`’s inspector.)
4. Does Sphere keep an `instrumentation: false` escape hatch (location-only mode)?

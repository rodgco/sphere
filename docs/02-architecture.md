# 02 — Architecture

## Shape

One npm package, three layers, no build step for the browser layer:

```
sphere/
  src/
    plugin/                 Node side: the Vite plugin
      index.ts              factory, the two plugin objects, option normalisation
      inject.ts             ids served to the page, SvelteKit template injection,
                            transformIndexHtml
      svelte-client.ts      the `svelte/internal/client` seam: ids, wrapper assembly
      options.ts            option validation
      virtual.ts            id → URL, and base handling
    runtime/                browser side, served as shipped source
      instrumentation.ts    wraps svelte/internal/client, instance registry, element stamps
      inspect.ts            element → payload (the only place that reads __svelte_meta);
                            installs window.__SPHERE__
      location.ts           the conservative matcher: verified / matched / enclosing
      source.ts             `/@fs` reads, cached per page, silent on failure
      budgets.ts            shared bounds + bounded, always-valid JSON clone
      format.ts             payload → markdown (pure, unit-tested)
    overlay/                Svelte, compiled by the host plugin, reached by `virtual:sphere/overlay`
      entry.ts              mounts the shadow host (the only node added to the page)
      Overlay.svelte        control, picking, marks, panel wiring
      Panel.svelte          picks, instructions, options, status line
      config.ts             reads `virtual:sphere/config`
      cursor.ts             the one crosshair while picking
      events.ts             native listeners, the shield action, `press`
      marks.ts              mark geometry and tracking
      picking.ts            the event matrix
      picks.ts              cap, toggle, labels
      position.ts           clamping, panel placement, clipping
      storage.ts            the two `localStorage` keys, validated
      styles.ts             the overlay stylesheet (shadow-root scoped)
    shared/                 shared by both sides
      payload.ts            the __SPHERE__ contract, in types
      paths.ts              project-relative paths, for the panel and the prompt
      version.ts            reported by the API and by `virtual:sphere/config`
```

Why sources instead of inlined strings: shipping the browser code as `?raw` strings would mean a
custom middleware and a separate `dist` entry. Serving real `.ts`/`.svelte` sources as virtual
modules lets Vite (and the host's Svelte plugin) do the transform, keeps everything typechecked,
and makes the overlay maintainable. This mirrors how `vite-plugin-svelte` serves its own inspector.

## Data flow

```
vite dev
  │
  ├─ resolveId/load  virtual:sphere/runtime      → instrumentation + inspect, mounted on import
  ├─ resolveId/load  virtual:sphere/overlay      → overlay component (Svelte), compiled by host
  ├─ resolveId/load  virtual:sphere/config       → { root, base, version } for this server
  └─ inject          <script type="module" src="/@id/__x00__virtual:sphere/runtime?...">
                                    │
browser page ───────────────────────┘
  runtime           wraps svelte/internal/client (only when enabled)
                    installs window.__SPHERE__ = { inspectElement, locateElement, version }
  overlay           imports runtime + config, mounts a shadow host, renders the Svelte UI
  user              picks elements → panel → Copy prompt → clipboard
```

Nothing else is involved: no HTTP endpoints of our own, no editor integration, no server
state. The plugin's only jobs are (a) serve modules, (b) inject the tag, (c) assemble the
instrumentation.

## Boundaries

| Boundary | Rule |
|---|---|
| Production build | The plugin is `apply: 'serve'`. Nothing may reference it from `src/`. |
| SSR | The instrumentation is client-only (`applyToEnvironment`). The Kit plugin transforms one SSR module (the generated app template) and instruments nothing. |
| App code | Sphere never imports from the app, and never patches globals other than `__SPHERE__`. |
| Host config | Sphere reads only `config.root`, `config.base` and its own option. |
| Filesystem | Reads via Vite's `/@fs` from the browser; no server-side file reading at all. |
| Network | None. The clipboard is the only exit. |

## Options (v1)

```ts
export interface SphereOptions {
  /** Master switch. Default: true when the plugin is in the array at all. */
  enabled?: boolean
  /** Maximum simultaneous selections. Default: 10. */
  maxSelections?: number
  /** Which parts are collected by default; the user can toggle them in the panel. */
  include?: { state?: boolean; props?: boolean; source?: boolean; template?: boolean }
  /** Overlay placement before the user drags it. Default: 'bottom-right'. */
  startPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** Extra attribute names that may identify an element in its source. */
  matchAttributes?: string[]
}
```

Only `enabled` is implemented today. `maxSelections`, `include`, `startPosition` and
`matchAttributes` are the specified v1 surface and are **not** accepted yet: passing one fails the
option validation loudly (`sphere: unknown option "…"`), which is the honest state while the
defaults are still hard-coded (`PICK_CAP`, the four panel toggles).

Options are validated once in `configResolved`; the browser receives `virtual:sphere/config` —
`{ root, base, version }` — never through the page URL and never in the app's HTML.

## Instrumentation is a separate concern from the overlay

- `instrumentation.ts` knows about Svelte internals; `inspect.ts` knows about DOM and metadata;
  `format.ts` knows nothing about either.
- The dependency runs one way: `instrumentation` installs the API and hands `inspect` the two
  accessors it needs (`instanceOf`, `frameOf`). `inspect` never imports the registry, so the
  module graph of the served sources stays acyclic.
- The instrumentation is appended to the served client module **only when enabled**
  (`docs/decisions/0002-opt-in-instrumentation.md`); `instrumentation` itself is imported by
  `inspect.ts` through a single accessor (`getRuntime()`), so a disabled Sphere has no cost.
- The overlay never touches Svelte metadata directly: it asks `inspectElement(node)`.

## Compatibility target

- Svelte 5.x (verified on 5.57), SvelteKit 2 and 3, Vite 8.3+.
- The instrumentation is validated per minor Svelte version in CI (`docs/08-testing.md` §6);
  a failing matrix entry is a release blocker.
- If a Svelte release changes `svelte/internal/client`, Sphere pins the supported range and
  fails loudly (a console warning listing the expected/actual exports) instead of silently
  producing wrong attribution.

## Failure posture

Every devtools-side effect is best-effort: the instrumentation wraps Svelte functions and must
always call through and return the original value, so a Sphere bug degrades the prompt, never
the app. The overlay runs in a shadow root and removes itself if it throws during mount.

## Package layout decision (open)

Single package (`sphere` with subpath exports + virtual modules) vs two (`@sphere/plugin`,
`@sphere/runtime`). Recommendation: **single package**, because both halves are versioned
together and the runtime is only ever loaded by the plugin. See
`docs/decisions/0006-single-package.md`.

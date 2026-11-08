# 02 — Architecture

## Shape

One npm package, three layers, no build step for the browser layer:

```
sphere/
  src/
    plugin/                 Node side: the Vite plugin
      index.ts              factory + option normalisation
      virtual-modules.ts    ids, resolve/load, config transport
      inject.ts             SvelteKit template injection + transformIndexHtml
      svelte-client.ts      the `svelte/internal/client` seam: ids, wrapper assembly
    runtime/                Browser side, served as virtual modules
      instrumentation.ts    wraps svelte/internal/client, instance registry, element stamps
      inspect.ts            element → payload (the only place that reads __svelte_meta);
                            installs window.__SPHERE__
      budgets.ts            shared bounds + bounded, always-valid JSON clone
      format.ts             payload → markdown (pure, unit-tested)
      overlay/              the UI, written in Svelte, compiled by the host plugin
        Overlay.svelte
        Panel.svelte
        marks.ts            outline bookkeeping (pure-ish)
        picking.ts          pointer handling + event swallowing
    shared/                 types shared by both sides
      payload.ts            the __SPHERE__ contract, in types
      version.ts            reported by the API until virtual:sphere/config carries it
```

Why sources instead of inlined strings: the prototype shipped its browser code as `?raw`
strings and had to stream it through a custom middleware and a separate `dist` entry. Serving
real `.ts`/`.svelte` sources as virtual modules lets Vite (and the host's Svelte plugin) do
the transform, keeps everything typechecked, and makes the overlay maintainable. This mirrors
how `vite-plugin-svelte` serves its own inspector.

## Data flow

```
vite dev
  │
  ├─ resolveId/load  virtual:sphere/runtime      → instrumentation + inspect, mounted on import
  ├─ resolveId/load  virtual:sphere/overlay      → overlay component (Svelte), compiled by host
  ├─ resolveId/load  virtual:sphere/config       → { root, base, options } for this server
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
| SSR | The instrumentation is client-only (`applyToEnvironment` / `transform` skips `ssr`). |
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

Options are validated once in `configResolved` and travel to the browser through
`virtual:sphere/config` (never through the page URL, never in the app's HTML).

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

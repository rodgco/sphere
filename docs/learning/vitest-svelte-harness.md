# Vitest + Svelte — compiling and mounting real components

What we had to prove to get `docs/08-testing.md` §3 (runtime harness) working without a browser.
Versions: Vitest 5.1, `@sveltejs/vite-plugin-svelte` 7.3, Svelte 5.57.

## 1. Vitest runs several environments; one of them is a client

A plugin that logs `environment.config.consumer` in `applyToEnvironment` sees three environments
in a node test run:

| Environment | `consumer` |
|---|---|
| `ssr` | `server` |
| `__vitest__` | `server` |
| `client` | `client` |

The module of a test is transformed in **`client`** with `options.ssr === false`, so a `.svelte`
file imported by a test is compiled **for the browser**, not with `svelte/server`. That is what
makes a harness possible without Playwright:

- `applyToEnvironment` gates (`consumer === 'client'`) let a dev-only plugin resolve ids in the
  environment that actually renders, and keep it out of the SSR pass.
- No browser mode, no `@testing-library/svelte` required: `mount()` from `svelte` works directly.

Consequence for the plugin under test: a redirect implemented in `resolveId` will be asked for ids
from **all** environments, including the SSR one, and its `load` may be called from an environment
where the plugin is not applied. Keep ids and any captured state inside the client environment's
lifecycle.

## 2. `resolve.conditions` must include `browser`

With the default conditions, `import { mount } from 'svelte'` resolves through Svelte's `default`
condition — `./src/index-server.js` — while the component was compiled for the client. The mount
then throws:

```js
// svelte/src/index-server.js
export function mount() { e.lifecycle_function_unavailable('mount') }
// svelte/src/internal/server/errors.js:125
// lifecycle_function_unavailable: `mount(...)` is not available on the server
```

The exports map (`svelte/package.json`) resolves `.` to `./src/index-client.js` only under the
`browser` condition. So the harness config sets:

```ts
resolve: { conditions: ['browser'] }
```

## 3. `unmount` is a function, not a method

`mount()` returns the component's exports object, not an app handle:

```ts
const app = mount(App, { target })
unmount(app)            // svelte/src/index-client.js
```

`app.unmount` only exists if the component exports something called `unmount`.

## 4. Dev metadata is element-local

With `compilerOptions.dev: true`, the compiler wraps every located node with `add_locations`
(`svelte/src/internal/client/dev/elements.js`), which assigns:

```js
element.__svelte_meta = {
  parent: dev_stack,                                    // component frames at render time
  loc: { file, line, column }                           // 1-based line, 0-based column
}
```

Assignment is **positional**: `assign_locations` walks the returned node and its siblings, one
location per entry (`location[2]` recurses into children). A component with several roots therefore
gets one location per root, in source order — and a child component rendered between two of them
gets its own file. That ordering is the foundation of the stamping in
`docs/03-instrumentation.md` §Rules 3.

Note: `dev_stack` is the *dev frame stack* (a snapshot of the component/block stack), which is why
the harness asserts only its presence; reading and indexing it belongs to the instrumentation.

## 5. A `\0`-prefixed id cannot be loaded by the test runner

Mapping `svelte/internal/client` to `\0virtual:sphere/svelte-client` works in a dev server: Vite
addresses the id as `/@id/__x00__virtual:sphere/svelte-client` and serves it. In Vitest the same
transform fails with:

```
Error: Cannot find module '/@id/__x00__virtual:sphere/svelte-client'
       imported from …/fixtures/harness/Child.svelte
```

Vitest's `client` environment rewrites imports to browser URLs but has no HTTP server behind them,
so nothing answers `/@id/…`. (It is not a race and not a cache: it reproduces on a clean
`node_modules/.vite`, and a run can appear to pass when the id was already registered by another
environment.)

Consequence for the harness: it writes the same generated text — from `wrapperModule()`, not a
copy — to `test/harness/generated/svelte-client.ts` and resolves the specifier to that file
(`test/harness/plugin.ts`), keeping the plugin's rule that only app modules are redirected. The
`\0` plumbing itself is proved against a real dev server in `test/client-gate.test.ts`.

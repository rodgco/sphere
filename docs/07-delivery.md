# 07 — Delivery (dev server)

How Sphere gets into the page, and the traps we already know about.

## 1. Plugin setup

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'   // plain Svelte apps
import { sphere } from 'sphere-plugin'

export default defineConfig({
  plugins: [sphere(), sveltekit()],        // before the Svelte plugin
})
```

- `apply: 'serve'`, `enforce: 'pre'` on everything: `enforce: 'pre'` matters for `resolveId` —
  the `svelte/internal/client` redirect must be resolved before any other plugin (the Svelte
  plugin compiles modules that import it).
- **Two plugin objects**, because they run in different environments:
  `sphere` (client only) resolves the seam, serves the runtime and injects the tag for plain Vite
  apps; `sphere:kit-inject` transforms SvelteKit's generated server module, which is an **SSR**
  module — a client-only gate would never see it.
- Client-only for the instrumentation: `applyToEnvironment(env) { return env.config.consumer ===
  'client' }`, so SSR never sees it.
- **`transformIndexHtml` exists only where it works.** SvelteKit warns about every plugin that
  *declares* the hook, whether or not it would run (`uses_unsupported_html_hook`,
  `@sveltejs/kit/src/exports/vite/utils.js`) and offers no opt-out. Sphere exposes the hook through
  a getter that answers `undefined` once the resolved plugin list shows SvelteKit: detection runs in
  `configResolved` because the config file's `plugins` array is not final in earlier hooks (nested
  `sveltekit()` arrays, and Vite rewrites the list while resolving). A Kit app starts clean instead
  of warning about a hook it never needed.
- Options are normalised once in `configResolved`; an invalid option fails at startup with a
  message naming it (dev-time, so failing loudly is cheap).

## 2. Modules served

| Id | Contents | Consumer |
|---|---|---|
| `virtual:sphere/config` | `export default { root, base, options, version }` | runtime, overlay |
| `virtual:sphere/runtime` | the instrumentation module: wrappers, `inspectElement`/`locateElement`, installs `window.__SPHERE__` | page |
| `virtual:sphere/overlay` | the Svelte overlay entry: mounts the shadow host and renders `<Overlay />` | page |
| `virtual:sphere/instrumentation` | resolved to `src/runtime/instrumentation.ts` (shipped source); the browser half of the client seam | generated client module |
| `virtual:sphere/svelte-client` | generated wrapper for `svelte/internal/client`; reached through the bare specifier from app modules only, and only generated when enabled | compiled components |

- **Sources are shipped, not inlined.** `resolveId('virtual:sphere/overlay')` returns the real
  path of `src/overlay/entry.ts` inside the published package (the `files` field must include
  `src/overlay` and `src/runtime`); Vite (and the host's Svelte plugin) compile it like any app
  file. This is how `vite-plugin-svelte`'s inspector serves its own components, and it gives us
  typechecking and coverage for free.
- The overlay is written in Svelte and compiled by the **host's** `svelte` version; `svelte` is a
  peer dependency. No bundling step in this repository.
- A single mount guard (`if (window.__SPHERE__) return`) keeps HMR from double-mounting the
  overlay or re-installing the runtime.

## 3. Getting the tag into the page

`transformIndexHtml` **does not run for SvelteKit's dev HTML** (SvelteKit renders `app.html`
through its own generated module). Two paths, in this order:

1. **SvelteKit (2 and 3)**: a `transform` on the generated server module
   - Kit 2: `.svelte-kit/generated/server/internal.js` → `templates.app = ({ head, body }) => "…"`
   - Kit 3: `.svelte-kit/generated/dev/server.js`
   Insert `<script type="module" src="<url>"></script>` immediately before the `</body>` of that
   literal. Because the template is a **JS string literal**, attribute quotes must be escaped once
   more (`\"`), or the emitted HTML loses them.
   Structural guards: bail out if the marker (`templates: {`) or the `app:` line is missing, and
   make the injection idempotent (skip when the URL is already present) — the module is
   re-transformed on HMR.
2. **Everything else**: `transformIndexHtml` with `injectTo: 'body'`, `type: 'module'`, `src`.

The URL is Vite's id URL:

```
/@id/virtual:sphere/runtime
```

**No `\0` in the id.** Vite encodes a `\0`-prefixed id as `__x00__`, but SvelteKit's dev
middleware does not unwrap it: `/@id/__x00__virtual:sphere/runtime` answers Kit's own 404 page,
while `/@id/virtual:sphere/runtime` is resolved like any other plugin id. Virtual ids that are
*imported* (the client wrapper) keep the `\0`; ids that are *fetched as URLs* must be URL-safe.

The base is added by whoever inserts the URL: a `transformIndexHtml` tag gets it from Vite's dev
HTML transform (`processNodeUrl`), so the hook returns the bare `/@id/…`; the SvelteKit template
is raw HTML and must be written as `<base>@id/…` itself. Either mistake fails quietly with a 404 —
the base missing on the raw path, or present twice. Never use an inline `import 'virtual:…'` in a
SvelteKit-injected script: Vite does not rewrite the bare specifier there.

## 4. Configuration transport

Root base and options travel in `virtual:sphere/config`, never in the injected URL and never in
the app's HTML. Two reasons: the absolute project path would be visible in every page's markup,
and a query string is a cache-busting hack we do not need (`Cache-Control` is Vite's business).
The runtime reads the config module once at import.

## 5. Reading source files

The browser reads a file with:

```
<base>@fs<absolute-path>?raw
```

- `?raw` returns `export default "<json string>"`; strip the wrapper and `JSON.parse` the literal.
- The absolute path is built from `config.root` + the Svelte-reported path when the latter is
  relative (Svelte reports both kinds).
- **The base prefix is mandatory** (`base: '/app/'` → a bare `/@fs/…` is a 404).
- Vite's `server.fs.allow` must include the project root (default) — the same root Sphere uses, so
  no extra configuration is expected. A denied read degrades silently: no source window.
- Reads are cached per file per page load (one fetch per file, not per selection).

## 6. Production

- `apply: 'serve'` on every plugin, plus `applyToEnvironment` client-only.
- CI asserts the built app contains no `sphere`/`virtual:sphere` reference (grep over `build/`).
- `sphere` must be safe to import in a config that also builds: the factory returns plugins, it
  does no I/O and reads no option at build time.

## 7. Templates and versions

| Environment | Verified | Notes |
|---|---|---|
| SvelteKit 3.1 + Vite 8.3 | yes — `fixtures/kit` + `test/kit-injection.test.ts` | inject into `generated/dev/server.js`; `svelte.config.js` is gone in Kit 3 (config via `sveltekit()`) |
| SvelteKit 2 + Vite 8 | transform only | `generated/server/internal.js`, shape covered by `test/inject.test.ts`; a real Kit 2 app is a matrix job (M5) |
| Plain Svelte + Vite 8 | yes — `fixtures/plain` | `transformIndexHtml` |
| `base: '/app/'` | transform only | Vite prefixes the tag; raw insertion calls `withBase` (`test/inject.test.ts`) |

Two dev servers over the same app directory fight over `.svelte-kit/generated`: any harness or
e2e script must run one server at a time.

# SvelteKit + Vite dev server — verified notes

What we hit while serving an overlay into a SvelteKit dev page, with the evidence that pins each
behaviour.

## 1. SvelteKit dev bypasses `transformIndexHtml`

SvelteKit serves the page itself: it takes `src/app.html`, substitutes `%sveltekit.head%` and
`%sveltekit.body%` in **its own generated module**, and returns the HTML. Vite's
`transformIndexHtml` hook is never involved — Vite even warns that a plugin using it "may not work
correctly" in a SvelteKit app.

Generated module paths:

| SvelteKit | Path |
|---|---|
| 2 | `.svelte-kit/generated/server/internal.js` |
| 3 | `.svelte-kit/generated/dev/server.js` |

The app template is a **JSON-escaped string literal** inside that module, so:

- `</body>` appears verbatim (JSON escaping leaves `/` alone), which makes “insert before the
  document's `</body>`” a safe, narrow anchor;
- attribute quotes inside an injected tag must be escaped once more (`\"`), or the emitted HTML
  loses them;
- the transform must be idempotent (the module is transformed again on HMR) and must bail out if
  the marker shape changes.

`vite-plugin-svelte`'s own inspector corroborates the problem: it injects by appending an import
to Vite's client module (`vite/dist/client/client.mjs`) with the comment
`// TODO: inject with transformIndexHtml when it works with SSR`.

## 2. Virtual modules can be referenced from HTML

Vite addresses a virtual module (`\0`-prefixed id) in the browser as:

```
/@id/__x00__virtual:my-module
```

- `__x00__` is the URL-safe encoding of `\0`; Vite unwraps it before resolving.
- This is how an injected `<script src>` can point at a module that imports other modules (a raw
  static file could not import anything without a bundler step).
- With a base, the URL must be prefixed: `/app/@id/__x00__virtual:my-module`.
- **Exception: `transformIndexHtml` tags.** A `src` returned from that hook is rewritten by
  Vite's dev HTML transform, which prefixes `config.base` to every root-relative URL
  (`processNodeUrl`, Vite 8.3.6 `dist/node/chunks/node.js`). The hook must therefore return
  `/@id/…`, not `/app/@id/…`; the prefixed form becomes `/app/app/@id/…` and 404s. Raw HTML
  insertion (the SvelteKit path, §1) skips that transform and does need the base.

## 3. `base` affects `/@fs` too

`baseMiddleware` (Vite `server/middlewares/base.ts`):

```js
if (pathname === base || pathname.startsWith(withTrailingSlash(base))) { strip base; next() }
else if (middlewareMode) next()
else if (pathname === '/' || pathname === '/index.html') redirect
else 404 (with a hint naming the base)
```

There is **no exception for `/@fs/`**. So with `base: '/app/'`:

| Request | Result |
|---|---|
| `/app/@fs/home/me/app/src/App.svelte?raw` | 200, file contents |
| `/@fs/home/me/app/src/App.svelte?raw` | 404 (base mismatch) |
| `/app/@fs/<path outside fs.allow>` | 403 “outside of Vite serving allow list” |

Any browser code reading source files must therefore know the base (we pass it in a virtual config
module, not in the URL, so the page markup stays identical on every machine).

## 4. `?raw` modules

`import('/@fs/<abs>?raw')` (or `fetch`) returns:

```js
export default "<the file, JSON-escaped>"
```

Parsing: strip the `export default ` prefix, strip a trailing `;`, `JSON.parse` the literal. No
regex over file contents is needed. `fs.allow` (default: project root, plus `node_modules`) decides
what is readable; a denied read is a 403 HTML page, not an exception — handle `!response.ok`.

## 5. Plugin ordering and environments

- `apply: 'serve'` + `enforce: 'pre'` for the plugin that must resolve `svelte/internal/client`
  before the Svelte plugin compiles app modules.
- Client vs SSR: Vite 8 exposes `this.environment` / `applyToEnvironment`; a `transform` hook also
  receives `{ ssr }`. Skip SSR explicitly — the runtime is browser code.
- Vite 8 module graph: `server.environments.ssr.transformRequest(id)` is the way to read a module
  through the pipeline in tests (the `environmentClient` counterpart exists too).

## 6. Two dev servers, one app directory

SvelteKit writes generated files into `<app>/.svelte-kit/` while serving (routes, `$app/paths`,
server modules). Two dev servers on the same directory overwrite each other's generated state and
can make the other one serve a page whose client module no longer matches — symptoms are missing
metadata, empty component trees and mysterious “no Svelte source location”.

Rules for harnesses and e2e scripts:

1. One dev server at a time (or one copy of the app per server).
2. Isolate `HOME`/`XDG_*` (the devtools token and Vite caches live there).
3. Free port on `127.0.0.1`, `--strictPort`.
4. Kill the **process group** in `finally`; a leaked server breaks the next run.
5. Wait for a real signal (HTTP 200 **and** a hydrated app), not `setTimeout`.

## 7. Testing hydration is browser work

Vitest resolves a module graph per project; a `.svelte` file compiles for one target. Rendering it
with `svelte/server` while it was compiled for the client fails inside `assign_nodes`
(`effect.nodes` is null). happy-dom cannot rescue this.

Therefore: hydration, SSR/CSR mismatches, `base` paths and event flow are tested with Playwright
against a real `vite dev` (the pattern `vite-plugin-svelte` uses for its inspector e2e).

## 8. Dev-only gating checklist

- [ ] every plugin has `apply: 'serve'`
- [ ] client-only transforms skip `{ ssr: true }`
- [ ] no `import` from the plugin in app code
- [ ] a production build of a fixture contains no reference (`grep` in CI)
- [ ] an app that does not enable the plugin gets upstream's modules, byte for byte

# 11 — Roadmap

Milestones are sized so each ends with something demonstrable. M0–M2 reproduce what the
prototype already proved; M3–M5 make it a product.

## M0 — Repository and scaffold

**Status:** done — the plugin lives in `src/plugin/`, the probe is proved by
`test/delivery.test.ts` against `fixtures/plain/` (`npm run dev` boots it), and the name is
`docs/decisions/0009-name-and-package.md`.

**Done when**

- Package skeleton: `package.json` (ESM, `engines: node >= 22`, no runtime deps if possible),
  `tsconfig.json` (strict), build config for the Node entry, `vitest` config.
- Lint/format/typecheck/test scripts wired in CI; `.github/workflows/ci.yml` with lint, typecheck,
  test, build.
- Decisions recorded: package name (`docs/decisions/0001`), opt-in mechanism (`0002`), single
  package (`0006`), overlay in Svelte (`0007`).
- License chosen and `LICENSE` added (default proposal: MIT, matching the ecosystem), plus
  `THIRD_PARTY.md` kept in sync from the first adapted file.
- A dummy plugin that injects a `console.log` into a plain Svelte app through
  `transformIndexHtml` (proves delivery).

## M1 — Instrumentation and inspection (no UI)

**Status:** done — the seam and its `enabled: false` proof, the wrappers (instance registry,
element stamps, block-callback ownership, `tag`/`tag_proxy`), `window.__SPHERE__` with
`inspectElement`/`locateElement` and the budgets, the runtime harness, and delivery into a real
SvelteKit 3 dev server (`fixtures/kit`). Kit 2's transform shape is unit-tested; a real Kit 2 app
runs in the M5 matrix.

**Done when**

- Wrapper module generated with/without the element stamps; upstream module byte-identical when
  off (test).
- `window.__SPHERE__.inspectElement` / `locateElement` implemented with the payload schema and
  budgets; valid-JSON invariant tested.
- Runtime harness: real Svelte fixtures for single root, multi-root with a child in between,
  `{#if}`, `{#each}`, snippets, props, derived state, big state.
- Version assertion + graceful degradation when a wrapped export is missing.
- SvelteKit injection (Kit 2 and 3) and `transformIndexHtml` path, with a fixture app.

## M2 — Overlay and picking

**Status:** done — the overlay (shadow root), the control with drag/persistence/keyboard, picking
with the event matrix, marks with clipping and tracking, and the panel shell with picks, options,
instructions and the status line. Covered by the runtime harness and by `e2e/picking.mjs` /
`e2e/a11y.mjs` in a real Chromium.

**Done when**

- Overlay (Svelte, shadow root) with control, drag, count, panel shell, theme, a11y baseline.
- Picking: hover outline + tooltip, primary-button swallow (event matrix), marks with numbers,
  unpick, cap message, scroll/resize/DOM tracking with ancestor clipping.
- Persistence of control position and options.
- e2e: `picking.mjs`, `a11y.mjs`.

## M3 — The prompt

**Status:** done — `format.ts` implements `docs/05-prompt-format.md` with a golden test, the
clipboard example is generated from the same fixture and diffed in CI, the panel copies with a
legacy fallback and an honest status line, and `e2e/clipboard.mjs` proves the pasted document in a
real browser (no rendered text, no machine paths, picks separated, Copy disabled when empty).

**Done when**

- `format.ts` implements `docs/05-prompt-format.md` exactly; golden test green.
- Instructions box, options, Copy prompt with clipboard fallback, Clear semantics, status line.
- e2e: `clipboard.mjs` (payload has no absolute paths, no rendered text; truncation notice).
- `docs/specs/clipboard-example.md` regenerated from the real output and diffed in CI.

## M4 — Locations done right

**Status:** done — `src/runtime/location.ts` implements the conservative matcher with every row of
the spec's test matrix as a unit test, `src/runtime/source.ts` reads files through `<base>@fs…?raw`
with a per-page cache and silent degradation, `virtual:sphere/config` carries root/base to the
browser, and `e2e/location.mjs` / `e2e/base-path.mjs` prove the four outcomes in a real browser.

**Done when**

- The conservative matcher, the note text, `~` in chip/tooltip: all cases of the test matrix exist
  as tests.
- e2e: `location.mjs` (verified, matched, enclosing, metadata dropped).
- Base path support: `base-path.mjs` green.
- Source window fetch, caching, degradation when the file is unreadable.

## M5 — Hardening and release

**Status:** done, with two explicit gaps. `prod-noop` is a test, `publint`/`attw` run in CI, the
Svelte-minor matrix runs the harness, the screenshots are generated with a privacy scan, changesets
and a provenance release workflow exist, and the version is `0.1.0`. Not done: a real SvelteKit 2
fixture job (the transform is unit-tested) and the bundle-size budget.


**Done when**

- Matrix jobs (Svelte minors, Kit 2/3, plain Vite) green; prod-noop grep green.
- Screenshot script + privacy scan + committed images + CI job.
- README with the two screenshots, a 60-second quickstart, and the security/privacy summary.
- `publint`/attw clean, changesets configured, `SECURITY.md`.
- First release: `0.1.0`, with the format documented as unstable until `1.0`.

## v2 candidates (not committed)

- **Agent surface**: a local MCP tool (`inspect_element`, `get_selection`) so an agent can ask for
  the same payload Sphere copies, and `copy_prompt` for parity with the UI. This is the natural
  upgrade path and the reason the payload is a typed schema, not just markdown.
- `redact` option (attribute/prop denylist) for shared screens or sensitive apps.
- Selecting by keyboard (`navKeys`-style parent/child/next/prev) for elements without hoverable
  area.
- Multi-frame support (iframe preview) — deliberately out of scope until asked.
- Adapter seam for other frameworks — only if Svelte traction justifies it.

## Out of the roadmap

- A hosted service, accounts, uploads.
- A browser extension.
- Applying edits or running commands.

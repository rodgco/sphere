# Sphere

**Turn what you see in a running Svelte app into precise context for a coding agent.**

Sphere is a dev-only Vite plugin for Svelte/SvelteKit. It puts a small control in your
app, lets you pick elements on the page, and copies a markdown prompt with everything an
agent needs to act on that part of the UI: the element's source location, the Svelte
template context it sits in, the component instance chain with props and live `$state`,
and a numbered source window — plus the instructions you typed.

Nothing leaves the browser: the payload goes to your clipboard.

> **Status: M1 in progress.** The plugin, its options, the delivery probe and the
> `svelte/internal/client` seam (with its export guard and the `enabled: false` proof) exist under
> `src/`, `fixtures/` and `test/`; there is no inspection or overlay yet. The behaviour in `docs/`
> is derived from a working prototype (a private fork of `vite-devtools-svelte` developed inside
> another project). `docs/11-roadmap.md` turns the specs into milestones.

## Why a separate project

The feature started as a pull request to `vite-devtools-svelte`. The work is correct and
tested, but it depends on that project's component-tracking runtime (a wrapped
`svelte/internal/client`), its dev-server delivery, its test harness and its release
train. Sphere owns that layer instead: one small package, one purpose, no gatekeeper,
and free to evolve the instrumentation and the UI together.

The trade-off is explicit (see `docs/10-risks.md`): Sphere carries the Svelte-internals
coupling itself and must keep up with Svelte releases.

## What it is not

- Not a devtools panel or a replacement for one. It is a *prompt builder*: pick → describe → copy.
- Not a browser extension. It is a Vite plugin, dev server only.
- Not a telemetry or analytics product: no network, no accounts, no upload.
- Not framework-agnostic yet. v1 is Svelte 5 / SvelteKit; the adapter seam exists in the
  architecture but is not a v1 promise.

## Development

```bash
npm install
npm run check     # lint, format check, typecheck, tests, build
npm run dev       # fixtures/plain on http://localhost:5201, probe in the console
```

The delivery probe (`virtual:sphere/hello`) is M0 scaffolding: it proves that a virtual module
reaches the page, and is replaced by the runtime entry in M1.

## Read this first

| Doc | What it answers |
|---|---|
| `docs/00-vision.md` | Who it is for, why it exists, how it differs from an inspector |
| `docs/01-scope-mvp.md` | Exactly what v1 does, with acceptance criteria |
| `docs/02-architecture.md` | Packages, data flow, dev-only boundaries |
| `docs/03-instrumentation.md` | How component instances, props and state are observed |
| `docs/04-element-inspection.md` | How a clicked node becomes a source location and a payload |
| `docs/05-prompt-format.md` | The exact clipboard document |
| `docs/06-toolbar-ux.md` | The floating control, picking, marks, panel, a11y |
| `docs/07-delivery.md` | Virtual modules, SvelteKit injection, base path, config |
| `docs/08-testing.md` | Unit / harness / browser / screenshot layers |
| `docs/09-security-and-privacy.md` | What may leave the page, and what may not |
| `docs/10-risks.md` | Internals coupling, version matrix, perf, maintenance |
| `docs/11-roadmap.md` | Milestones and exit criteria |
| `docs/learning/` | What we verified about Svelte, SvelteKit and Vite while building the prototype |
| `docs/reuse/` | Inventory of the prototype, what to port, what to rewrite, licensing |
| `docs/decisions/` | ADRs: the decisions already made, and why |
| `docs/specs/` | Payload schema, location algorithm, a real clipboard example |

## Principles

1. **Dev-only by construction.** Every piece is `apply: 'serve'`; a production build cannot
   contain it, and CI proves that.
2. **Opt-in and free when off.** With the option off, the served Svelte client module is the
   upstream one — no wrapper, no instrumentation, no branch in a hot path.
3. **Honest context.** A line number is either verified against the element's own markup or
   labelled as the enclosing element. A value is either the real value or visibly summarised.
4. **Bounded work.** Inspecting one element has a fixed budget (nodes, characters, instances),
   because it runs inside a click handler.
5. **Clipboard, not network.** The only output channel is the user's clipboard.
6. **Test the hard parts in a browser.** Hydration, event swallowing and base paths cannot be
   proven in jsdom.

## Name

**SPHERE** — *Svelte Prompt Helper: Element Region Explorer* — the sphere of context around a piece
of UI. The package is **`sphere-plugin`**, which is what a project adds; the plugin factory is
`sphere()`. See `docs/decisions/0009-name-and-package.md`.

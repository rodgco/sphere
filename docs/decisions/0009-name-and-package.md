# 0009 — SPHERE is an acronym; the package is `sphere-plugin`

## Context

`docs/decisions/0008-package-name.md` chose `svelte-sphere` on availability grounds and treated
“sphere” as a metaphor (the sphere of context around a piece of UI). That was incomplete: the name
was always meant as an acronym, and the author reads the package name as the thing you add to a
project, not as the project. The acronym's S is Svelte, which makes `svelte-sphere` say “Svelte”
twice.

`sphere` on npm is taken; `sphere-plugin` is free (registry check at decision time).

## Decision

**SPHERE** expands to *Svelte Prompt Helper: Element Region Explorer*.

- Package: **`sphere-plugin`**.
- Plugin factory: `sphere()` — unchanged.
- Runtime global: `window.__SPHERE__` — unchanged.
- The product is referred to as “Sphere” in prose, with the expansion taught once.

## Consequences

- The install line states the mechanism (`plugin`) and the brand states the product; the framework
  constraint lives in the acronym and in the `svelte`/`sveltekit` package keywords, so npm search
  still finds it.
- The acronym binds the product to Svelte: a framework-agnostic future (`docs/10-risks.md`) would
  need a new name, not a rewrite of this one. The adapter seam stays a v2 candidate, so the cost is
  hypothetical today.
- “Element Region Explorer” describes the whole (pick a region, get its context), not each layer;
  `docs/02-architecture.md` keeps the layer names (`instrumentation`, `inspect`, `format`, `overlay`)
  so nobody has to map acronym letters onto modules.
- Renaming is free now (unpublished, `0.0.0`); after `1.0` it would need a deprecation and a
  redirect.
- `docs/decisions/0008-package-name.md` is superseded on the name; its availability findings and
  the “not a `vite-plugin-*` name” reasoning still hold.

## Alternatives considered

- **Keep `svelte-sphere`** (0008): available and discoverable, but redundant with the acronym's S
  and silent about being a plugin.
- **`sphere`**: right brand, taken on npm.
- **`@sphere/dev`**: available, keeps the umbrella free for an MCP bridge or CLI, but needs an npm
  org and loses the word a user searches for (“plugin”); `docs/decisions/0006-single-package.md`
  already argues against making users choose a scope at install time.

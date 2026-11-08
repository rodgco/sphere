# 0008 — Package name: `svelte-sphere`

> **Superseded by [0009](0009-name-and-package.md)** on the name (SPHERE is an acronym; the package
> is `sphere-plugin`). The registry findings and the “not a `vite-plugin-*` name” reasoning below
> still hold.

## Context

`docs/decisions/0001-independent-project.md` left the name open (`sphere`, `svelte-sphere`,
`@scope/sphere`) and made it an M0 exit criterion. The name sets the install line, the import in the
user's `vite.config.ts`, and how the package is found. It also has to communicate the two facts a
user needs before installing: it is for Svelte, and it is a build-time tool, not a runtime library.

Registry check at decision time (npm registry, `GET /<name>`):

| Name | Status |
|---|---|
| `sphere` | taken |
| `svelte-sphere` | free |
| `vite-plugin-sphere` | free |
| `@sphere/plugin` | free (scope unregistered) |

## Decision

Publish one package, **`svelte-sphere`**, exporting a `sphere()` plugin factory.

```ts
import { sphere } from 'svelte-sphere'
```

## Consequences

- `sphere` alone is unavailable, so no short unscoped name exists; `svelte-` prefix matches the
  ecosystem's convention for Svelte-only packages and keeps the framework constraint in the name.
- The exported function stays `sphere()` and the runtime global stays `window.__SPHERE__`, so a
  future rename of the package does not change user code inside the page or the docs' vocabulary.
- The package is not named `vite-plugin-*` even though it is a Vite plugin: the product is the
  prompt builder, not a generic Vite utility, and the plugin is only its delivery mechanism.
- Renaming after `1.0` would need a deprecation and a redirect; before `1.0` it is a minor.
- A scope (`@sphere/…`) stays available for a future sibling (MCP bridge, CLI), per
  `docs/decisions/0006-single-package.md`.

## Alternatives considered

- **`sphere`**: short and honest about the product, but taken on npm.
- **`vite-plugin-sphere`**: fits the plugin naming convention, but advertises the mechanism and
  buries the domain; users looking for “prompt from my Svelte UI” would not find it.
- **`@sphere/plugin`**: needs an npm org before first publish, and docs already treat Sphere as one
  package; a scope adds an install decision with no benefit at this size.
- **`svelte-prompt`**: describes the output, not the tool, and collides with prompt-engineering
  packages.

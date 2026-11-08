# 0006 — One package, no monorepo

## Context

Sphere has a Node side (the Vite plugin) and a browser side (runtime + overlay). A monorepo with
`@sphere/plugin` and `@sphere/runtime` would separate concerns, but both halves are versioned
together, the runtime is only ever loaded by the plugin, and the browser side ships as sources that
the host compiles.

## Decision

One npm package (`sphere`) with subpath exports for types and (if needed) the manifest, and virtual
modules for everything the browser imports. Sources for the overlay live in `src/overlay/` and are
included in the published `files`.

## Consequences

- One version, one changelog, one install, one lockfile entry.
- The published package contains TypeScript/Svelte sources (dev-only tool, compiled by the host);
  `publint` must be configured to accept that and the `files` field must be explicit.
- If a second consumer appears (e.g. an MCP bridge, a CLI), it becomes a subpath or a sibling package
  in an ADR, not a refactor of this one.

## Alternatives considered

- **pnpm workspace with two packages**: real isolation, but two version bumps per change and an
  install story that confuses users (“which package do I add?”).
- **Bundled runtime** (build the browser half to JS at publish time): no host compilation needed, but
  duplicates the Svelte runtime and breaks typechecking/coverage of the overlay.

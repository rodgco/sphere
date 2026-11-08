/**
 * `.svelte` modules are compiled by the host's Svelte plugin; `tsc` only needs the
 * import to resolve. Component typechecking is `svelte-check`'s job once the overlay
 * lands (M2).
 */
declare module '*.svelte' {
  import type { Component } from 'svelte'

  const component: Component
  export default component
}

/**
 * Svelte ships no types for its private client runtime, and Sphere must not invent
 * them: the instrumentation validates the exports it needs at runtime and degrades
 * when one is missing (`src/runtime/instrumentation.ts`). A shorthand declaration is
 * the honest state — delete it if Svelte ever types this entry.
 */
/**
 * Served by the plugin (`virtual:sphere/config`), never fetched by the page as a URL. Typed here
 * because it is a virtual module and `tsc` cannot see what the plugin returns.
 */
declare module 'virtual:sphere/config' {
  const config: { root: string; base: string; version: string }
  export default config
}

declare module 'svelte/internal/client'

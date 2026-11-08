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

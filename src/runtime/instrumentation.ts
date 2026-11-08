/**
 * The runtime half of the `svelte/internal/client` seam.
 *
 * This module is served as source and compiled by the host's Vite, then imported by
 * the generated client module. It sees the upstream namespace as an argument, so it
 * needs no import of its own for Svelte internals — and it is only ever in the graph
 * when Sphere is enabled.
 *
 * Rules from docs/03-instrumentation.md §Rules: call through always, degrade instead
 * of guessing, and never let a Sphere bug break the app.
 */

/**
 * The upstream bindings the instrumentation wraps. This list is the contract with
 * Svelte: a test asserts each name exists in the installed `svelte/internal/client`
 * (`test/instrumentation.test.ts`), so a Svelte release that drops one fails here
 * instead of silently producing a prompt without component context.
 */
export const REQUIRED_EXPORTS = [
  'push',
  'pop',
  'add_svelte_meta',
  'add_locations',
  'tag',
  'tag_proxy',
  'component',
  'each',
  'if',
] as const

export type UpstreamClient = Record<string, unknown>

/** One warning per upstream namespace, so HMR cannot spam the console. */
const warned = new WeakSet<object>()

/**
 * Validates the upstream surface and installs the instrumentation.
 *
 * At M1 step 1 this only validates; the wrappers arrive with the frame stack. The
 * missing-export path is already exercised because it is the one that must never
 * throw: an unsupported Svelte degrades to no component context, not to a broken app.
 */
export function installInstrumentation(upstream: UpstreamClient): void {
  const missing = REQUIRED_EXPORTS.filter((name) => typeof upstream[name] !== 'function')
  if (missing.length === 0) return
  if (warned.has(upstream)) return

  warned.add(upstream)
  console.warn(
    `[sphere] unsupported svelte/internal/client: missing ${missing.join(', ')}. ` +
      'Instrumentation is off; the prompt will lack component context.',
  )
}

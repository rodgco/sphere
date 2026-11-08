import { fileURLToPath } from 'node:url'

/**
 * The seam between app code and Svelte's client runtime.
 *
 * Compiled components import `svelte/internal/client`; when Sphere is enabled the
 * plugin answers that specifier with a generated module that re-exports the whole
 * upstream surface and can shadow a fixed set of bindings with instrumented ones.
 * The upstream file is imported by its resolved id, so the wrapper never imports
 * itself and uses the host project's Svelte, not the plugin's copy.
 *
 * When Sphere is disabled the specifier is not resolved at all: app code gets
 * Svelte's own module, so "off" means "the module does not exist", not "the module
 * is quiet" (docs/decisions/0002-opt-in-instrumentation.md).
 */
export const CLIENT_SPECIFIER = 'svelte/internal/client'

export const INSTRUMENTATION_SPECIFIER = 'virtual:sphere/instrumentation'

export const WRAPPER_ID = '\0virtual:sphere/svelte-client'

/** `\0`-ids are addressed in the browser through `__x00__`; see docs/07-delivery.md §3. */
export const WRAPPER_URL = '/@id/__x00__virtual:sphere/svelte-client'

/**
 * Absolute path of a file in `src/runtime/`.
 *
 * `src/plugin/*` (tests, source mode) and `dist/plugin/*` (published) are both two
 * levels below the package root, so one relative URL reaches the shipped source in
 * both cases. The runtime is served as source and compiled by the host's Vite.
 */
export function runtimeSource(name: string): string {
  return fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url))
}

/**
 * The generated client module.
 *
 * Deliberately text, not a template with conditionals: the only decision (enabled
 * or not) is made before this is called, so the module never contains a branch of
 * its own. `export *` first, so a later commit can add `export const { push } = …`
 * and shadow exactly those bindings; local exports win over star exports.
 */
export function wrapperModule(upstreamId: string): string {
  const upstream = JSON.stringify(upstreamId)

  return [
    `import * as __sphereUpstream from ${upstream}`,
    `import { installInstrumentation } from ${JSON.stringify(INSTRUMENTATION_SPECIFIER)}`,
    `export * from ${upstream}`,
    '',
    'installInstrumentation(__sphereUpstream)',
    '',
  ].join('\n')
}

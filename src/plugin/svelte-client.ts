import { isAbsolute, relative } from 'node:path'
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
  return sourceFile(`runtime/${name}`)
}

/** Any shipped source, relative to `src/` and without the extension. */
export function sourceFile(name: string): string {
  return fileURLToPath(new URL(`../../src/${name}.ts`, import.meta.url))
}

/**
 * Whether an importer is app code: a file inside the project and outside `node_modules`.
 *
 * The redirect is deliberately narrow. Svelte's own modules import
 * `svelte/internal/client` too (`src/attachments/index.js` does), and pointing those at
 * the wrapper makes the wrapper import itself through Svelte's internals — a cycle that
 * changes nothing (the wrapper only re-exports) and breaks the module graph. Internal
 * calls are meant to bypass the wrapper: instrumentation needs the entry points compiled
 * components use, not Svelte's private call sites.
 */
export function isAppModule(importer: string | undefined, root: string): boolean {
  if (!importer) return false

  const id = importer.split('?')[0] ?? ''
  if (!isAbsolute(id)) return false
  // Vite ids are usually `/`-separated even on Windows, so `path.sep` alone is not enough.
  if (id.split(/[\\/]/).includes('node_modules')) return false

  const rel = relative(root, id)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * The wrapper's replacements, split because four of them are reserved words: an export
 * *name* may be `if`, a local binding may not, so those are renamed on the way out.
 */
export const OVERRIDES = [
  'push',
  'pop',
  'add_svelte_meta',
  'add_locations',
  'tag',
  'tag_proxy',
  'component',
  'each',
] as const

export const RESERVED_OVERRIDES = ['if', 'key'] as const

/**
 * The generated client module.
 *
 * Deliberately text, not a template with conditionals: the only decision (enabled or
 * not) is made before this is called, so the module never contains a branch of its own.
 * `export *` keeps the whole upstream surface; the local exports below shadow exactly the
 * bindings in `REQUIRED_EXPORTS`, because a local export wins over a star export.
 */
export function wrapperModule(upstreamId: string): string {
  const upstream = JSON.stringify(upstreamId)
  const reserved = RESERVED_OVERRIDES.map((name) => `__sphere_${name}`)

  return [
    `import * as __sphereUpstream from ${upstream}`,
    `import { installInstrumentation } from ${JSON.stringify(INSTRUMENTATION_SPECIFIER)}`,
    `export * from ${upstream}`,
    '',
    'const __sphere = installInstrumentation(__sphereUpstream)',
    `export const { ${OVERRIDES.join(', ')} } = __sphere`,
    ...(RESERVED_OVERRIDES.length > 0
      ? [
          `const { ${RESERVED_OVERRIDES.map((name, i) => `${name}: ${reserved[i]}`).join(', ')} } = __sphere`,
          `export { ${RESERVED_OVERRIDES.map((name, i) => `${reserved[i]} as ${name}`).join(', ')} }`,
        ]
      : []),
    '',
  ].join('\n')
}

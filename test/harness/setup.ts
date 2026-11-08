import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { wrapperModule } from '../../src/plugin/svelte-client.js'

export const generatedDir = resolve(import.meta.dirname, 'generated')

/** Where the harness keeps the wrapper it hands to the test graph (gitignored). */
export const wrapperFile = resolve(generatedDir, 'svelte-client.ts')

/**
 * Writes the wrapper to disk before the test graph is built.
 *
 * The dev server serves it from a `\0`-prefixed id; Vitest's client environment has no HTTP
 * layer to fetch `/@id/…` from, so the harness writes the *same generated text* — produced by
 * the same `wrapperModule()` the plugin uses — to a real file and resolves the specifier to it.
 * Only the delivery differs; the runtime and the module text are the ones the browser gets.
 *
 * The upstream path is resolved from Node, which gives the host project's Svelte because the
 * harness lives in it.
 */
export default function setup(): void {
  const upstream = createRequire(import.meta.url).resolve('svelte/internal/client')

  mkdirSync(dirname(wrapperFile), { recursive: true })
  writeFileSync(wrapperFile, wrapperModule(upstream))
}

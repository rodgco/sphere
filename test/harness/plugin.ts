import type { Plugin, ResolvedConfig } from 'vite'
import {
  CLIENT_SPECIFIER,
  INSTRUMENTATION_SPECIFIER,
  isAppModule,
  runtimeSource,
} from '../../src/plugin/svelte-client.js'
import { wrapperFile } from './setup.js'

/**
 * The delivery shim for the harness.
 *
 * It applies the plugin's *rules* — app modules only, same virtual ids — but resolves the
 * client specifier to the generated file instead of a `\0`-id, because Vitest's client
 * environment has no HTTP server to serve `/@id/…` from. The real id plumbing is covered
 * against a real dev server in `test/client-gate.test.ts`; this file exists so the runtime
 * under test is otherwise the same code the browser gets.
 */
export function harnessWrapper(): Plugin {
  let root = process.cwd()

  return {
    name: 'sphere-harness',
    enforce: 'pre',

    configResolved(config: ResolvedConfig) {
      root = config.root
    },

    resolveId(id, importer) {
      if (id === INSTRUMENTATION_SPECIFIER) return runtimeSource('instrumentation')
      if (id === CLIENT_SPECIFIER && isAppModule(importer, root)) return wrapperFile
      return null
    },
  }
}

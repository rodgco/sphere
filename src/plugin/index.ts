import type { Plugin } from 'vite'
import { resolveOptions, type ResolvedOptions, type SphereOptions } from './options.js'
import {
  CLIENT_SPECIFIER,
  INSTRUMENTATION_SPECIFIER,
  WRAPPER_ID,
  isAppModule,
  runtimeSource,
  wrapperModule,
} from './svelte-client.js'
import { HELLO_ID, idToUrl } from './virtual.js'

export type { ResolvedOptions, SphereOptions } from './options.js'

/**
 * M0 payload of the delivery probe: it proves that a module loaded as a virtual
 * module runs in the page. It must never carry app data.
 */
const HELLO_SOURCE = `console.log('[sphere] dev-only probe served from ${HELLO_ID.slice(1)}')\n`

/**
 * The dev-only plugin.
 *
 * Delivery rules that are load-bearing (docs/07-delivery.md §1):
 * `apply: 'serve'` keeps it out of builds, `enforce: 'pre'` resolves our ids before
 * the Svelte plugin compiles imports, and `applyToEnvironment` keeps SSR out.
 */
export function sphere(options: SphereOptions = {}): Plugin[] {
  // Fail in the config file, naming the option, before a server exists.
  let resolved: ResolvedOptions = resolveOptions(options)

  /** Resolved through the rest of the pipeline, so it is the host project's Svelte. */
  let upstreamId: string | null = null
  let root = process.cwd()

  return [
    {
      name: 'sphere',
      apply: 'serve',
      enforce: 'pre',

      configResolved(config) {
        resolved = resolveOptions(options)
        root = config.root
      },

      applyToEnvironment(environment) {
        return environment.config.consumer === 'client'
      },

      async resolveId(id, importer) {
        if (!resolved.enabled) return null

        if (id === INSTRUMENTATION_SPECIFIER) return runtimeSource('instrumentation')
        if (id === HELLO_ID) return HELLO_ID
        if (id !== CLIENT_SPECIFIER || !isAppModule(importer, root)) return null

        // Ask the rest of the pipeline where this Svelte's client entry actually is;
        // `skipSelf` keeps the answer from being this hook again.
        const upstream = await this.resolve(id, importer, { skipSelf: true })
        if (!upstream) return null

        upstreamId = upstream.id
        return WRAPPER_ID
      },

      load(id) {
        if (id === HELLO_ID) return HELLO_SOURCE
        if (id !== WRAPPER_ID || upstreamId === null) return null
        return wrapperModule(upstreamId)
      },

      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          if (!resolved.enabled || !context.server) return html

          const src = idToUrl(HELLO_ID)
          if (html.includes(src)) return html

          return {
            html,
            tags: [{ tag: 'script', attrs: { type: 'module', src }, injectTo: 'body' }],
          }
        },
      },
    },
  ]
}

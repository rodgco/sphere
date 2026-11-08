import type { Plugin } from 'vite'
import { resolveOptions, type ResolvedOptions, type SphereOptions } from './options.js'
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

  return [
    {
      name: 'sphere',
      apply: 'serve',
      enforce: 'pre',

      configResolved() {
        resolved = resolveOptions(options)
      },

      applyToEnvironment(environment) {
        return environment.config.consumer === 'client'
      },

      resolveId(id) {
        return id === HELLO_ID ? HELLO_ID : null
      },

      load(id) {
        return id === HELLO_ID ? HELLO_SOURCE : null
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

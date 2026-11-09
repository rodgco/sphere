import type { IndexHtmlTransform, Plugin } from 'vite'
import {
  CONFIG_ID,
  injectIntoKitModule,
  injectionSrc,
  injectionTag,
  isKitTemplateModule,
  OVERLAY_ID,
  RUNTIME_ID,
  usesSvelteKit,
} from './inject.js'
import { resolveOptions, type ResolvedOptions, type SphereOptions } from './options.js'
import {
  CLIENT_SPECIFIER,
  INSTRUMENTATION_SPECIFIER,
  WRAPPER_ID,
  isAppModule,
  runtimeSource,
  sourceFile,
  wrapperModule,
} from './svelte-client.js'
import { VERSION } from '../shared/version.js'

export type { ResolvedOptions, SphereOptions } from './options.js'

/**
 * The dev-only plugin.
 *
 * Two plugin objects, because they run in different environments: the client half resolves the
 * `svelte/internal/client` seam, serves the runtime and injects the tag for plain Vite apps
 * (`transformIndexHtml`, client only); the Kit half transforms SvelteKit's generated server
 * module, which is an **SSR** module — a client-only gate would never see it.
 *
 * Delivery rules that are load-bearing (docs/07-delivery.md §1): `apply: 'serve'` keeps both out
 * of builds, `enforce: 'pre'` resolves our ids before the Svelte plugin compiles imports, and the
 * client gate keeps the instrumentation out of SSR.
 */
export function sphere(options: SphereOptions = {}): Plugin[] {
  // Fail in the config file, naming the option, before a server exists.
  let resolved: ResolvedOptions = resolveOptions(options)

  /** Resolved through the rest of the pipeline, so it is the host project's Svelte. */
  let upstreamId: string | null = null
  /** Set by the `config` hook; `true` when SvelteKit's own plugins are present. */
  let svelteKit: boolean | null = null
  let root = process.cwd()
  let base = '/'

  const client: Plugin = {
    name: 'sphere',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      resolved = resolveOptions(options)
      root = config.root
      base = config.base

      // SvelteKit warns about every plugin that *has* a `transformIndexHtml` hook, whether or not
      // the hook would run (`uses_unsupported_html_hook`). The resolved plugin list is the only one
      // that is complete, and both checks read the hook after `configResolved`; the getter above
      // therefore answers `undefined` for Kit, whose pages are served by `sphere:kit-inject`.
      svelteKit = usesSvelteKit(config.plugins)
    },

    applyToEnvironment(environment) {
      return environment.config.consumer === 'client'
    },

    config(config) {
      // SvelteKit warns about every plugin that *has* a `transformIndexHtml` hook, whether or not
      // the hook would run. Record the answer before the hook map is built; the getter below keeps
      // it absent for Kit, whose pages are served by `sphere:kit-inject` instead.
      svelteKit = usesSvelteKit(config.plugins)
    },

    // `undefined` at runtime for SvelteKit apps — Vite treats an absent hook as absent, and Kit's
    // warning check must not see one. The type forbids it, so the cast is deliberate.
    get transformIndexHtml(): IndexHtmlTransform {
      return (svelteKit === false ? plainViteTag() : undefined) as IndexHtmlTransform
    },

    async resolveId(id, importer) {
      if (!resolved.enabled) return null

      // Two entry points, both served as shipped source and compiled by the host's Vite:
      // the overlay (what the page loads) and the runtime on its own (tests, and future sinks).
      if (id === OVERLAY_ID || id === `\0${OVERLAY_ID}`) return sourceFile('overlay/entry')

      if (id === RUNTIME_ID || id === `\0${RUNTIME_ID}` || id === INSTRUMENTATION_SPECIFIER) {
        return runtimeSource('instrumentation')
      }

      if (id === CONFIG_ID || id === `\0${CONFIG_ID}`) return `\0${CONFIG_ID}`

      if (id !== CLIENT_SPECIFIER || !resolved.instrumentation || !isAppModule(importer, root)) {
        return null
      }

      // Ask the rest of the pipeline where this Svelte's client entry actually is;
      // `skipSelf` keeps the answer from being this hook again.
      const upstream = await this.resolve(id, importer, { skipSelf: true })
      if (!upstream) return null

      upstreamId = upstream.id
      return WRAPPER_ID
    },

    load(id) {
      if (id === `\0${CONFIG_ID}`) {
        // Never in the page's HTML and never in a URL: the absolute project path stays here
        // (docs/07 §4), and the overlay reads it once at import.
        return `export default ${JSON.stringify({ root, base, version: VERSION })}\n`
      }

      if (id !== WRAPPER_ID || upstreamId === null) return null
      return wrapperModule(upstreamId)
    },
  }

  /** The hook itself: a separate object so its presence can depend on the project. */
  function plainViteTag() {
    return {
      order: 'pre' as const,
      handler(html: string, context: { server?: unknown }) {
        if (!resolved.enabled || !context.server) return html

        const src = injectionSrc(base, { absolute: false })
        if (html.includes(src)) return html

        return {
          html,
          tags: [{ tag: 'script', attrs: { type: 'module', src }, injectTo: 'body' as const }],
        }
      },
    }
  }

  const kit: Plugin = {
    name: 'sphere:kit-inject',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      base = config.base
    },

    transform(code, id) {
      if (!resolved.enabled || !isKitTemplateModule(id)) return null

      const { code: injected, injected: changed } = injectIntoKitModule(
        code,
        injectionTag(base, { absolute: true }),
      )

      // `map: null` is honest: the insertion is a script tag inside a string literal, so the
      // original mappings still describe every line that existed before it.
      return changed ? { code: injected, map: null } : null
    },
  }

  return [client, kit]
}

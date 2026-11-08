import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import { sphere } from '../src/plugin/index.js'

const kitPlugins = [{ name: 'vite-plugin-sveltekit-setup' }]

function resolve(plugin: Plugin, plugins: unknown[]): void {
  ;(plugin.configResolved as unknown as (config: unknown) => void).call(
    {},
    {
      plugins,
      root: '/app',
      base: '/',
    },
  )
}

function handlerOf(plugin: Plugin) {
  const hook = plugin.transformIndexHtml
  if (hook === undefined) return undefined
  return typeof hook === 'function' ? hook : hook.handler
}

describe('the plain-Vite HTML hook', () => {
  it('is absent until the project is known, so SvelteKit never sees it', () => {
    const [plugin] = sphere()
    expect(plugin?.transformIndexHtml).toBeUndefined()
  })

  it('stays absent when SvelteKit is present', () => {
    const [plugin] = sphere()
    resolve(plugin as Plugin, kitPlugins)

    expect(plugin?.transformIndexHtml).toBeUndefined()
  })

  it('appears for a plain Vite project and injects the overlay tag once', () => {
    const [plugin] = sphere()
    resolve(plugin as Plugin, [{ name: 'vite-plugin-svelte' }])

    const handler = handlerOf(plugin as Plugin)
    expect(handler).toBeTypeOf('function')

    const run = handler as unknown as (html: string, ctx: unknown) => unknown
    const result = run('<html><body></body></html>', { server: {} }) as {
      tags?: Array<{ attrs: { src: string } }>
    }

    expect(result.tags?.[0]?.attrs.src).toBe('/@id/virtual:sphere/overlay')
  })
})

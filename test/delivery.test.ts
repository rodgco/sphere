import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { sphere } from '../src/plugin/index.js'
import { boot, closeServers, fixtureRoot, page } from './lib/vite.js'

afterEach(closeServers)

const OVERLAY_URL = '/@id/virtual:sphere/overlay'

describe('delivery through a plain Svelte app', () => {
  it('injects the runtime into index.html of the fixture', async () => {
    const { origin } = await boot({ configFile: resolve(fixtureRoot, 'vite.config.ts') })

    const html = await page(origin)
    expect(html).toContain(`src="${OVERLAY_URL}"`)
    expect(html).toContain('type="module"')

    // The injected module is the instrumentation source, which installs the API on import.
    const module = await page(origin, OVERLAY_URL)
    expect(module).toContain('mountOverlay')
    expect(module).not.toContain('dev-only probe')
  })

  it('injects nothing when the option is off', async () => {
    const { origin } = await boot({
      configFile: false,
      plugins: [sphere({ enabled: false }), svelte()],
    })

    const html = await page(origin)
    expect(html).not.toContain('@id/')
    expect(html).not.toContain('virtual:sphere')
  })

  it('lets Vite prefix the base path exactly once', async () => {
    const { origin } = await boot({
      configFile: false,
      base: '/app/',
      plugins: [sphere(), svelte()],
    })

    const html = await page(origin, '/app/')
    // Vite's dev HTML transform adds the base to a root-relative tag src.
    expect(html).toContain(`src="/app${OVERLAY_URL}"`)
    expect(html).not.toContain('/app/app/')

    const module = await page(origin, `/app${OVERLAY_URL}`)
    expect(module).toContain('mountOverlay')
  })
})

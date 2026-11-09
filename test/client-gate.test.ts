import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { sphere } from '../src/plugin/index.js'
import { WRAPPER_URL } from '../src/plugin/svelte-client.js'
import { boot, closeServers, fixtureRoot, importSpecifiers, page, transform } from './lib/vite.js'

afterEach(closeServers)

const svelteModule = /node_modules\/svelte\/|\.vite\/deps/

describe('the svelte/internal/client seam', () => {
  it('sends compiled components to the generated wrapper when enabled', async () => {
    const { server, origin } = await boot({ configFile: resolve(fixtureRoot, 'vite.config.ts') })

    const app = await transform(server, '/src/App.svelte')
    expect(app).toContain(WRAPPER_URL)

    const wrapper = await page(origin, WRAPPER_URL)
    expect(wrapper).toContain('export * from')
    expect(wrapper).not.toContain('from "svelte/internal/client"')

    const imports = importSpecifiers(wrapper).filter((specifier) => !specifier.includes('runtime/'))
    expect(imports.length).toBeGreaterThan(0)
    for (const specifier of imports) {
      const response = await fetch(new URL(specifier, origin))
      expect(response.status, `GET ${specifier}`).toBe(200)
    }

    expect(wrapper).toContain('installInstrumentation')
  })

  it('leaves the upstream module alone when instrumentation is off', async () => {
    const { server } = await boot({
      configFile: false,
      plugins: [sphere({ instrumentation: false }), svelte()],
    })

    const app = await transform(server, '/src/App.svelte')
    expect(app).toMatch(svelteModule)
    expect(app).not.toContain('svelte-client')
  })

  it('leaves the upstream module alone when disabled', async () => {
    const { server, origin } = await boot({
      configFile: false,
      plugins: [sphere({ enabled: false }), svelte()],
    })

    const app = await transform(server, '/src/App.svelte')
    expect(app).toMatch(svelteModule)
    expect(app).not.toContain('svelte-client')

    const wrapper = await fetch(new URL(WRAPPER_URL, origin))
    const body = await wrapper.text()
    // Vite's SPA fallback answers unknown URLs with index.html, so "not generated"
    // surfaces as HTML rather than as a 404.
    expect(wrapper.headers.get('content-type')).toContain('text/html')
    expect(body).not.toContain('__sphereUpstream')
  })
})

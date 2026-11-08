import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { createServer, type InlineConfig, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { sphere } from '../src/plugin/index.js'

const fixtureRoot = resolve(import.meta.dirname, '../fixtures/plain')
const PROBE_URL = '/@id/__x00__virtual:sphere/hello'

const servers: ViteDevServer[] = []

async function boot(config: InlineConfig): Promise<string> {
  const server = await createServer({
    root: fixtureRoot,
    logLevel: 'silent',
    server: { port: 0, strictPort: false },
    ...config,
  })
  servers.push(server)

  await server.listen()
  const origin = server.resolvedUrls?.local[0]
  if (!origin) throw new Error('dev server reported no local URL')
  return origin
}

async function page(origin: string, path = '/'): Promise<string> {
  const response = await fetch(new URL(path, origin))
  expect(response.status).toBe(200)
  return response.text()
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

describe('delivery through a plain Svelte app', () => {
  it('injects the probe into index.html of the fixture', async () => {
    const origin = await boot({ configFile: resolve(fixtureRoot, 'vite.config.ts') })

    const html = await page(origin)
    expect(html).toContain(`src="${PROBE_URL}"`)
    expect(html).toContain('type="module"')

    const module = await page(origin, PROBE_URL)
    expect(module).toContain('virtual:sphere/hello')
  })

  it('injects nothing when the option is off', async () => {
    const origin = await boot({
      configFile: false,
      plugins: [sphere({ enabled: false }), svelte()],
    })

    const html = await page(origin)
    expect(html).not.toContain('@id/')
    expect(html).not.toContain('virtual:sphere')
  })

  it('lets Vite prefix the base path exactly once', async () => {
    const origin = await boot({
      configFile: false,
      base: '/app/',
      plugins: [sphere(), svelte()],
    })

    const html = await page(origin, '/app/')
    // Vite's dev HTML transform adds the base to a root-relative tag src.
    expect(html).toContain(`src="/app${PROBE_URL}"`)
    expect(html).not.toContain('/app/app/')

    const module = await page(origin, `/app${PROBE_URL}`)
    expect(module).toContain('virtual:sphere/hello')
  })
})

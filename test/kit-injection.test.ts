import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isKitTemplateModule } from '../src/plugin/inject.js'
import { kitFixtureInstalled, startKitServer, type SpawnedServer } from './lib/kit.js'

const RUNTIME_URL = '/@id/virtual:sphere/runtime'

// The fixture has its own `node_modules`; CI installs it (see .github/workflows/ci.yml). Locally,
// a missing install skips instead of failing, but a skip in CI is a failure.
const available = kitFixtureInstalled()
const suite = available ? describe : describe.skip

describe('SvelteKit fixture', () => {
  it('is installed when CI asks for it', () => {
    if (process.env.CI) expect(available).toBe(true)
  })
})

suite('injection into a real SvelteKit dev server', () => {
  let server: SpawnedServer

  beforeAll(async () => {
    server = await startKitServer()
  }, 40_000)

  afterAll(async () => {
    await server?.stop()
  })

  it('puts the tag into the HTML that SvelteKit renders', async () => {
    const response = await fetch(`${server.origin}/`)
    expect(response.status).toBe(200)

    const html = await response.text()
    expect(html).toContain('data-testid="kit-page"')
    expect(html).toContain(`<script type="module" src="${RUNTIME_URL}"></script>`)
    // Quotes inside the template literal survived the injection.
    expect(html).toContain('type="module"')
  })

  it('injects once, even though the module is transformed again on HMR', async () => {
    const html = await (await fetch(`${server.origin}/`)).text()
    expect(html.split(RUNTIME_URL)).toHaveLength(2)
  })

  it('serves the runtime module the tag asks for', async () => {
    const response = await fetch(`${server.origin}${RUNTIME_URL}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('installSphereApi')
  })
})

describe('kit module detection', () => {
  it('matches both generated file layouts', () => {
    expect(isKitTemplateModule('/app/.svelte-kit/generated/dev/server.js')).toBe(true)
    expect(isKitTemplateModule('/app/.svelte-kit/generated/server/internal.js')).toBe(true)
  })
})

import { readFileSync } from 'node:fs'
import { vi } from 'vitest'

/**
 * The overlay reads source files through Vite (`/@fs/<path>?raw`). The harness has no dev server,
 * so this answers the same URL shape from disk: the resolution path (and therefore the chip and the
 * source window) stays testable, deterministically, without depending on what may be listening on
 * localhost — which is exactly how a test that passed locally failed in CI.
 */
vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const at = url.indexOf('@fs')

  if (at === -1) return new Response('', { status: 404 })

  const file = decodeURIComponent(url.slice(at + 3).split('?')[0] ?? '')

  try {
    const text = readFileSync(file, 'utf8')
    return new Response(`export default ${JSON.stringify(text)}`, { status: 200 })
  } catch {
    return new Response('', { status: 404 })
  }
})

import { resolve } from 'node:path'
import { createServer, type InlineConfig, type ViteDevServer } from 'vite'

export const fixtureRoot = resolve(import.meta.dirname, '../../fixtures/plain')

const servers: ViteDevServer[] = []

export interface DevServer {
  server: ViteDevServer
  origin: string
}

/** Boots a real dev server on a free port; one per test, closed by `closeServers`. */
export async function boot(config: InlineConfig = {}): Promise<DevServer> {
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

  return { server, origin }
}

export async function closeServers(): Promise<void> {
  await Promise.all(servers.splice(0).map((server) => server.close()))
}

export async function page(origin: string, path = '/'): Promise<string> {
  const response = await fetch(new URL(path, origin))
  if (response.status !== 200) throw new Error(`GET ${path} → ${response.status}`)
  return response.text()
}

/** Server-side module transform: the client graph's view of a module, no browser. */
export async function transform(server: ViteDevServer, url: string): Promise<string> {
  const result = await server.environments.client.transformRequest(url)
  if (!result) throw new Error(`no transform result for ${url}`)
  return result.code
}

export function importSpecifiers(code: string): string[] {
  return [...code.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map((match) => match[1]!)
}

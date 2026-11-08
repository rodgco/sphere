import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

/** The SvelteKit fixture app; its dependencies are installed separately (`npm --prefix`). */
export const kitRoot = resolve(import.meta.dirname, '../../fixtures/kit')

export function kitFixtureInstalled(): boolean {
  return existsSync(resolve(kitRoot, 'node_modules/vite/bin/vite.js'))
}

export interface SpawnedServer {
  origin: string
  stop(): Promise<void>
}

/**
 * Starts the Kit fixture's dev server on a free port, in its own process group.
 *
 * Docs/08 §8: one server at a time, its own port, and the process **group** killed in `finally`,
 * because a leaked Vite holds `.svelte-kit/generated` and breaks the next run.
 */
export async function startKitServer(): Promise<SpawnedServer> {
  const port = await freePort()
  const child = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'dev',
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    {
      cwd: kitRoot,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' },
    },
  )

  let output = ''
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()))
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()))

  const origin = `http://127.0.0.1:${port}`

  try {
    await waitForPage(origin, () => output)
  } catch (error) {
    await stopGroup(child)
    throw error
  }

  return { origin, stop: () => stopGroup(child) }
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolvePort(port))
    })
  })
}

async function waitForPage(origin: string, log: () => string): Promise<void> {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }

  throw new Error(`SvelteKit fixture did not start in 30s:\n${log()}`)
}

async function stopGroup(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  try {
    if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }

  await Promise.race([
    once(child, 'exit'),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ])
}

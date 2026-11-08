import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

/**
 * One dev server per script, on a free port, in its own process group.
 *
 * docs/08 §8: two dev servers over the same app directory fight over generated state, and a leaked
 * server breaks the next run — so the group is killed in `finally`, never with a timer.
 */
export async function startDevServer({ root }) {
  const port = await freePort()
  const child = spawn(
    process.execPath,
    [
      resolve(root, '../../node_modules/vite/bin/vite.js'),
      'dev',
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let output = ''
  child.stdout.on('data', (chunk) => (output += chunk.toString()))
  child.stderr.on('data', (chunk) => (output += chunk.toString()))

  const origin = `http://127.0.0.1:${port}`
  await waitForPage(origin, () => output)

  return { origin, stop: () => stopGroup(child) }
}

async function freePort() {
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

async function waitForPage(origin, log) {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150))
  }

  throw new Error(`dev server did not start in 30s:\n${log()}`)
}

async function stopGroup(child) {
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

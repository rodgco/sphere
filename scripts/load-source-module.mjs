/**
 * Loads a TypeScript module from `src/` for the generator scripts.
 *
 * Node's type stripping does not rewrite `.js` import specifiers to `.ts`, and these modules are
 * written for a bundler (`./format.js` → `format.ts`). Vite is already a dependency and does that
 * resolution, so the generators ask Vite instead of duplicating the rules in a loader.
 */
import { createServer } from 'vite'

export async function loadSourceModule(path) {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    return await server.ssrLoadModule(path)
  } finally {
    await server.close()
  }
}

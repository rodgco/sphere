import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import { sphere } from '../src/plugin/index.js'

const fixtureRoot = resolve(import.meta.dirname, '../fixtures/plain')
const outDir = resolve(import.meta.dirname, '../.temp/prod-noop')

function readTree(directory: string): Array<{ file: string; text: string }> {
  const files: Array<{ file: string; text: string }> = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...readTree(path))
    else files.push({ file: path, text: readFileSync(path, 'utf8') })
  }

  return files
}

/**
 * M5's promise, as a test: a production build cannot contain Sphere. Every plugin is
 * `apply: 'serve'`, so the build never resolves the seam, never emits the overlay and never
 * injects the tag — this proves it instead of assuming it.
 */
describe('a production build', () => {
  it('contains no trace of Sphere', async () => {
    rmSync(outDir, { recursive: true, force: true })

    await build({
      root: fixtureRoot,
      configFile: false,
      logLevel: 'silent',
      plugins: [sphere(), svelte()],
      build: { outDir, emptyOutDir: true },
    })

    const files = readTree(outDir)
    expect(files.length).toBeGreaterThan(0)

    const leaks = files.filter(({ text }) =>
      /virtual:sphere|__SPHERE__|sphere-plugin|\[sphere\]/i.test(text),
    )

    expect(leaks.map(({ file }) => file.replace(fixtureRoot, ''))).toEqual([])
    rmSync(outDir, { recursive: true, force: true })
  }, 60_000)

  it('keeps the fixture app itself free of the plugin', () => {
    // The fixture imports the plugin only from its vite config, never from app code.
    const main = readFileSync(resolve(fixtureRoot, 'src/main.ts'), 'utf8')
    expect(main).not.toContain('sphere')
  })
})

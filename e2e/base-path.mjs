/**
 * A dev server with `base: '/app/'`: the overlay must load, picking must work, and the source read
 * must go through the base (`/app/@fs/…`), because Vite's base middleware answers 404 otherwise.
 *
 *   node e2e/base-path.mjs
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { panel, startPicking, withPage } from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const server = await startDevServer({ root, args: ['--base', '/app/'] })

  try {
    await withPage(async (page) => {
      const base = `${server.origin}/app/`
      await page.goto(base)
      await page.locator('[data-testid="title"]').waitFor()

      // The overlay is loaded through the base, so the tag resolved and the module arrived.
      assert(
        (await page.locator('#sphere-host').count()) === 1,
        'overlay did not load under a base',
      )

      await startPicking(page)
      await page.locator('#app-button').click()
      await panel(page).waitFor()
      await panel(page).getByRole('button', { name: 'Copy prompt' }).click()
      await panel(page).locator('.status').filter({ hasText: 'Copied' }).waitFor()

      const prompt = await page.evaluate(() => navigator.clipboard.readText())

      assert(prompt.includes(`Page: \`${base}\``), `wrong page line:\n${prompt}`)
      assert(prompt.includes('- markup: `src/App.svelte:'), `no location under a base:\n${prompt}`)
      // The source window only exists if `/app/@fs/…?raw` answered; the base prefix is mandatory.
      assert(
        prompt.includes('Source of `src/App.svelte`:'),
        `no source window under a base:\n${prompt}`,
      )
      assert(!prompt.includes('/@fs/'), 'the prompt leaked a dev-server URL')
    })
  } finally {
    await server.stop()
  }

  console.log('base-path: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

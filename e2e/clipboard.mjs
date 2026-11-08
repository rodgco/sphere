/**
 * The clipboard, in a real browser: the document a user actually pastes.
 *
 *   node e2e/clipboard.mjs
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { control, expectAttribute, panel, startPicking, withPage } from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const server = await startDevServer({ root })

  try {
    await withPage(async (page) => {
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      await startPicking(page)
      await page.locator('#app-link').click()
      await page.locator('#app-button').click()
      await panel(page).waitFor()

      const instructions = panel(page).getByRole('textbox', { name: 'Instructions' })
      await instructions.fill('Make the CTA a solid button and keep the counter.')

      await panel(page).getByRole('button', { name: 'Copy prompt' }).click()

      const status = panel(page).locator('.status')
      await status.filter({ hasText: 'Copied' }).waitFor()

      const clipboard = await page.evaluate(() => navigator.clipboard.readText())

      // The document's shape.
      assert(clipboard.startsWith('# UI context from the running app\n\n'), 'missing header')
      assert(
        clipboard.includes(`Page: \`${server.origin}/\``),
        'missing page line (or absolute path leaked)',
      )
      assert(
        clipboard.includes('## What I need\n\nMake the CTA a solid button and keep the counter.'),
        'instructions lost',
      )
      assert(clipboard.includes('### Selected element a#app-link'), 'first pick missing')
      assert(clipboard.includes('### Selected element button#app-button'), 'second pick missing')
      assert(clipboard.match(/\n---\n\n### Selected element/), 'picks are not separated by a rule')
      assert(clipboard.includes('Component chain (innermost first):'), 'no component chain')
      assert(clipboard.includes('- DOM path: `'), 'no DOM path')

      // The two things the format forbids.
      assert(!clipboard.includes('go to the next page'), 'rendered text leaked into the prompt')
      assert(!clipboard.includes('clicked 0 times'), 'rendered text leaked into the prompt')
      assert(
        !/\/home\/|\/Users\/|node_modules/.test(clipboard),
        'machine path or node_modules leaked',
      )

      // The status line reports the size, and copying ends picking.
      const copied = clipboard.length
      assert(
        (await status.textContent())?.trim() ===
          `Copied ${copied.toLocaleString('en').replaceAll(',', ' ')} chars`,
        `unexpected status: ${await status.textContent()}`,
      )
      await expectAttribute(page, control(page), 'aria-pressed', 'false')

      // Copy is unavailable with nothing picked, and Clear empties the form.
      await startPicking(page)
      await page.locator('#app-link').click()
      await panel(page).waitFor()
      await panel(page).getByRole('button', { name: 'Clear' }).click()

      const copy = panel(page).getByRole('button', { name: 'Copy prompt' })
      assert(await copy.isDisabled(), 'Copy prompt should be disabled with no picks')
    })
  } finally {
    await server.stop()
  }

  console.log('clipboard: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

/**
 * Keyboard selection, in a browser: walk to a container the pointer cannot reach, pick it, undo,
 * and prove that handled keys never scroll the page or reach the app.
 *
 *   node e2e/keyboard.mjs
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  chip,
  control,
  expectAttribute,
  marks,
  panel,
  startPicking,
  withPage,
} from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const tooltip = (page) => page.locator('.tooltip')

/** The overlay renders on its own schedule; wait for the count instead of assuming it. */
async function waitForMarks(page, expected) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await marks(page).count()) === expected) return
    await page.waitForTimeout(50)
  }
  throw new Error(`expected ${expected} marks, saw ${await marks(page).count()}`)
}

async function main() {
  const server = await startDevServer({ root })

  try {
    await withPage(async (page) => {
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      // The pointer picks the heading; the card around it is only reachable with `w`.
      await startPicking(page)
      await page.locator('.card h2').first().click()
      assert((await marks(page).count()) === 1, 'the heading was not picked')

      await page.keyboard.press('w')
      await tooltip(page).waitFor()
      const widened = (await tooltip(page).textContent()) ?? ''
      assert(
        widened.startsWith('article') || widened.startsWith('div'),
        `w did not widen: ${widened}`,
      )

      await page.keyboard.press('Enter')
      await waitForMarks(page, 2)
      assert(
        ((await chip(page).textContent()) ?? '').trim() === '2 picked',
        'the chip did not count both',
      )

      await page.keyboard.press('Backspace')
      await waitForMarks(page, 1)

      // The cursor is on the card after widening; `s` descends to the heading, `d` crosses to the
      // paragraph inside it.
      await page.keyboard.press('s')
      await page.keyboard.press('d')
      const sibling = (await tooltip(page).textContent()) ?? ''
      assert(sibling.startsWith('p'), `s then d did not reach the paragraph: ${sibling}`)

      // A handled key must not scroll the page.
      const before = await page.evaluate(() => window.scrollY)
      await page.keyboard.press('ArrowDown')
      const after = await page.evaluate(() => window.scrollY)
      assert(before === after, `ArrowDown scrolled the page: ${before} → ${after}`)

      // Typing in the instructions is typing, not navigation.
      await panel(page).waitFor()
      const instructions = panel(page).getByRole('textbox', { name: 'Instructions' })
      await instructions.click()
      await page.keyboard.type('wdd c')
      assert(
        (await instructions.inputValue()) === 'wdd c',
        `the panel swallowed the typing: ${await instructions.inputValue()}`,
      )
      assert((await marks(page).count()) === 1, 'typing in the panel changed the picks')

      // Escape leaves picking and the page gets its keys back.
      await page.keyboard.press('Escape')
      await expectAttribute(page, control(page), 'aria-pressed', 'false')
    })
  } finally {
    await server.stop()
  }

  console.log('keyboard: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

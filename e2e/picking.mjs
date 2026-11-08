/**
 * Picking, proved in a browser. Every case in `docs/specs/event-matrix.md`'s test table that needs
 * a real page lives here.
 *
 *   node e2e/picking.mjs
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  chip,
  control,
  counters,
  expectAttribute,
  marks,
  panel,
  startPicking,
  withPage,
} from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))
const link = (page) => page.locator('#app-link')

async function main() {
  const server = await startDevServer({ root })

  try {
    await withPage(async (page) => {
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      // 1. Picking a link does not navigate, and the app never sees the click.
      await startPicking(page)
      const before = await counters(page)
      await link(page).click()

      if (page.url() !== `${server.origin}/`) throw new Error(`navigated to ${page.url()}`)
      await marks(page).first().waitFor()
      if ((await marks(page).count()) !== 1) throw new Error('expected exactly one pick')

      const after = await counters(page)
      if (after.click !== before.click) throw new Error('the app received the swallowed click')
      if (after.pointerdown !== before.pointerdown) {
        throw new Error('the app received a pointerdown while picking')
      }

      // 2. Leaving picking gives the page back: the same click now navigates.
      await control(page).click()
      await expectAttribute(page, control(page), 'aria-pressed', 'false')
      await link(page).click()
      await page.waitForURL(/navigated=1/)
      await page.locator('[data-testid="title"]').waitFor()

      // 3. A right click while picking reaches the app and is not a pick.
      await page.goto(server.origin)
      await startPicking(page)
      const beforeRight = await counters(page)
      await link(page).click({ button: 'right' })

      const afterRight = await counters(page)
      if (afterRight.contextmenu <= beforeRight.contextmenu)
        throw new Error('contextmenu was swallowed')
      if ((await marks(page).count()) !== 0) throw new Error('a right click was treated as a pick')

      // 4. The panel is usable while picking, and using it is not a pick.
      await link(page).click()
      await panel(page).waitFor()
      const beforeClear = await counters(page)
      await panel(page).getByRole('button', { name: 'Clear' }).click()

      if ((await marks(page).count()) !== 0) throw new Error('Clear did not empty the picks')
      if ((await counters(page)).click !== beforeClear.click) {
        throw new Error('clicking the panel reached the app')
      }

      // 5. Escape leaves picking, closes the panel and gives the page back.
      await link(page).click()
      await panel(page).waitFor()
      await page.keyboard.press('Escape')

      await panel(page).waitFor({ state: 'detached' })
      await expectAttribute(page, control(page), 'aria-pressed', 'false')

      const beforeButton = await counters(page)
      await page.locator('#app-button').click()
      if ((await counters(page)).click <= beforeButton.click) {
        throw new Error('the page did not get its click back after Escape')
      }

      // 6. Typing in the instructions stays in the instructions.
      await startPicking(page)
      await page.locator('#app-button').click()
      await panel(page).waitFor()

      const beforeTyping = await counters(page)
      const instructions = panel(page).getByRole('textbox', { name: 'Instructions' })
      await instructions.click()
      await page.keyboard.type('make it square')

      if ((await instructions.inputValue()) !== 'make it square') {
        throw new Error('the instructions did not receive the typing')
      }
      const afterTyping = await counters(page)
      if (afterTyping.keydown !== beforeTyping.keydown) {
        throw new Error('typing in the panel triggered the app keydown listeners')
      }

      // 7. Marks follow the page as it scrolls, and follow a scrollable ancestor.
      await page.keyboard.press('Escape')
      await page.evaluate(() => window.scrollTo(0, 0))
      await startPicking(page)
      await page.locator('#app-button').click()

      const mark = marks(page).first()
      const beforeScroll = await mark.boundingBox()
      await page.evaluate(() => window.scrollBy(0, 60))
      await page.waitForTimeout(80)
      const afterScroll = await mark.boundingBox()

      if (!beforeScroll || !afterScroll) throw new Error('the mark disappeared on scroll')
      if (Math.abs(beforeScroll.y - afterScroll.y - 60) > 2) {
        throw new Error(`the mark did not follow the scroll: ${beforeScroll.y} → ${afterScroll.y}`)
      }

      // A pane that scrolls on its own moves the element inside it, and the mark with it.
      await page.locator('#pane').evaluate((pane) => pane.scrollTo(0, 320))
      await page.locator('#deep').click()
      const deepMark = marks(page).nth((await marks(page).count()) - 1)
      const beforePane = await deepMark.boundingBox()

      await page.locator('#pane').evaluate((pane) => pane.scrollBy(0, -40))
      await page.waitForTimeout(80)
      const afterPane = await deepMark.boundingBox()

      if (!beforePane || !afterPane) throw new Error('the mark disappeared when the pane scrolled')
      if (Math.abs(afterPane.y - beforePane.y - 40) > 2) {
        throw new Error(
          `the mark did not follow the scrollable ancestor: ${beforePane.y} → ${afterPane.y}`,
        )
      }

      if ((await chip(page).textContent())?.trim() !== '2 picked') {
        throw new Error('the chip did not report the picks')
      }
    })
  } finally {
    await server.stop()
  }

  console.log('picking: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

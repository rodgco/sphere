/**
 * The accessibility baseline of `docs/06-toolbar-ux.md` §8, checked in a real browser.
 *
 *   node e2e/a11y.mjs
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { control, expectAttribute, panel, withPage } from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function activeHostId(page) {
  return page.evaluate(() => document.activeElement?.id ?? '')
}

async function tabTo(page, predicate, limit = 20) {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab')
    if (await predicate()) return true
  }
  return false
}

async function main() {
  const server = await startDevServer({ root })

  try {
    await withPage(async (page) => {
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      // 1. The control is reachable with Tab and toggles with Enter and Space.
      const reached = await tabTo(page, async () => (await activeHostId(page)) === 'sphere-host')
      assert(reached, 'the control was not reachable with Tab')

      await page.keyboard.press('Enter')
      await expectAttribute(page, control(page), 'aria-pressed', 'true')
      await page.keyboard.press('Space')
      await expectAttribute(page, control(page), 'aria-pressed', 'false')

      // 2. Focus ring: keyboard focus is visible, and it is not the browser default outline.
      await control(page).focus()
      const outline = await control(page).evaluate((element) => {
        const style = getComputedStyle(element)
        return { style: style.outlineStyle, width: style.outlineWidth }
      })
      assert(outline.style !== 'none' && outline.width !== '0px', `no focus ring: ${outline.style}`)

      // 3. Every button in the overlay has an accessible name.
      await page.keyboard.press('Enter')
      await page.locator('#app-link').click()
      await panel(page).waitFor()

      const unnamed = await page.evaluate(() => {
        const host = document.getElementById('sphere-host')
        const buttons = [...(host?.shadowRoot?.querySelectorAll('button') ?? [])]
        return buttons
          .filter((button) => {
            const label = button.getAttribute('aria-label') ?? button.textContent ?? ''
            return label.trim() === ''
          })
          .map((button) => button.outerHTML.slice(0, 80))
      })
      assert(unnamed.length === 0, `buttons without a name: ${unnamed.join(', ')}`)

      // 4. The panel is a labelled dialog and the instructions take focus when it opens from a pick.
      assert((await panel(page).getAttribute('aria-label')) === 'Build a prompt', 'dialog label')
      const focusInInstructions = await page.evaluate(
        () => document.getElementById('sphere-host')?.shadowRoot?.activeElement?.tagName,
      )
      assert(focusInInstructions === 'TEXTAREA', `focus was on ${focusInInstructions}, not the box`)

      // 5. Tab reaches the options and Space toggles one; the choice is persisted.
      const reachedOptions = await tabTo(page, async () =>
        page.evaluate(
          () =>
            document
              .getElementById('sphere-host')
              ?.shadowRoot?.activeElement?.getAttribute('type') === 'checkbox',
        ),
      )
      assert(reachedOptions, 'the option checkboxes were not reachable with Tab')

      await page.keyboard.press('Space')
      const stored = await page.evaluate(() => localStorage.getItem('sphere:options'))
      assert(stored !== null && stored.includes('false'), `the option was not persisted: ${stored}`)

      // 6. Escape closes the panel and returns focus to the control.
      await page.keyboard.press('Escape')
      await panel(page).waitFor({ state: 'detached' })
      assert((await activeHostId(page)) === 'sphere-host', 'focus did not return to the control')
      await expectAttribute(page, control(page), 'aria-pressed', 'false')

      // 7. The count chip exposes its state.
      await page.keyboard.press('Enter')
      await expectAttribute(page, control(page), 'aria-pressed', 'true')
      await page.locator('#app-button').click()
      await panel(page).waitFor()
      const chip = page.locator('.chip')
      assert((await chip.getAttribute('aria-expanded')) === 'true', 'chip aria-expanded')
    })
  } finally {
    await server.stop()
  }

  console.log('a11y: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

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

      // 2. Focus ring: it sits on the pill, and only for keyboard focus. A pointer press focuses
      //    the control without painting a rectangle around the label.
      const ring = () =>
        page.evaluate(() => {
          const shell = document
            .getElementById('sphere-host')
            ?.shadowRoot?.querySelector('.control')
          const style = shell ? getComputedStyle(shell) : null
          return {
            class: shell?.classList.contains('focus-ring') ?? false,
            outline: style?.outlineStyle ?? null,
          }
        })

      await control(page).click()
      await page.waitForTimeout(60)
      const afterPointer = await ring()
      assert(
        !afterPointer.class && afterPointer.outline === 'none',
        `a pointer press painted a ring: ${JSON.stringify(afterPointer)}`,
      )

      await page.evaluate(() =>
        document.getElementById('sphere-host')?.shadowRoot?.querySelector('.inspect')?.blur(),
      )
      const reachedKeyboard = await tabTo(
        page,
        async () => (await activeHostId(page)) === 'sphere-host',
      )
      assert(reachedKeyboard, 'the control was not reachable with Tab again')
      const afterKeyboard = await ring()
      assert(
        afterKeyboard.class && afterKeyboard.outline !== 'none',
        `no focus ring for the keyboard: ${JSON.stringify(afterKeyboard)}`,
      )

      // 3. Every button in the overlay has an accessible name. The ring checks left picking on
      //    (the pointer press toggled it); make the state explicit instead of assuming it.
      if ((await control(page).getAttribute('aria-pressed')) !== 'true') {
        await page.keyboard.press('Enter')
        await expectAttribute(page, control(page), 'aria-pressed', 'true')
      }
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
      const focusInPanel = await page.evaluate(() =>
        document.getElementById('sphere-host')?.shadowRoot?.activeElement?.getAttribute('role'),
      )
      assert(focusInPanel === 'dialog', `focus was on ${focusInPanel}, not the dialog`)

      // Tabbing moves into the panel and reaches the instruction box: close button, the pick's
      // remove button, then the box. The dialog takes the focus, not the box, so that single-key
      // picking keeps working until the user chooses to type.
      let focusInInstructions = ''
      for (let step = 0; step < 8 && focusInInstructions !== 'TEXTAREA'; step += 1) {
        await page.keyboard.press('Tab')
        focusInInstructions = await page.evaluate(
          () => document.getElementById('sphere-host')?.shadowRoot?.activeElement?.tagName ?? '',
        )
      }
      assert(
        focusInInstructions === 'TEXTAREA',
        `Tab did not reach the instruction box (${focusInInstructions})`,
      )

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

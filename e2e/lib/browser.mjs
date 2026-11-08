import { chromium } from 'playwright'

/**
 * A headless Chromium with a clean context, and the helpers the scripts share.
 *
 * The browser is the only layer that can prove picking: event swallowing, focus and hydration are
 * not observable in jsdom (`docs/08-testing.md` §4).
 */
export async function withPage(run) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()

  const problems = []
  page.on('pageerror', (error) => problems.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })

  try {
    return await run(page, context)
  } finally {
    await browser.close()
    if (problems.length > 0) {
      throw new Error(`page errors:\n${problems.join('\n')}`)
    }
  }
}

/** The overlay lives in a shadow root; Playwright's CSS engine pierces it. */
export const control = (page) => page.locator('.inspect')
export const panel = (page) => page.getByRole('dialog', { name: 'Build a prompt' })
export const chip = (page) => page.locator('.chip')
export const marks = (page) => page.locator('.mark')

export async function startPicking(page) {
  await control(page).click()
  await expectAttribute(page, control(page), 'aria-pressed', 'true')
}

export async function expectAttribute(page, locator, name, value) {
  const actual = await locator.getAttribute(name)
  if (actual !== value) throw new Error(`expected ${name}="${value}", got "${actual}"`)
}

export async function counters(page) {
  return page.evaluate(() => ({ ...window.__sphereTestCounters }))
}

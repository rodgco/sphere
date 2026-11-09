/**
 * The theme bridge, proved in a browser (`docs/13-theming.md` §3 and §8).
 *
 * The CSSOM behaviours in the spec — a page custom property inheriting into a shadow root, inline
 * style winning over it, and an attribute-selected palette beating `prefers-color-scheme` — cannot
 * be observed outside a real engine.
 *
 *   node e2e/theme.mjs
 */
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { withPage } from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

/** A computed value from inside the overlay's shadow root. */
async function styleOf(page, selector, properties) {
  return page.evaluate(
    ({ selector, properties }) => {
      const host = document.getElementById('sphere-host')
      const element = host?.shadowRoot?.querySelector(selector)
      if (!element) return null
      const style = getComputedStyle(element)
      return Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]))
    },
    { selector, properties },
  )
}

async function main() {
  const server = await startDevServer({
    root,
    args: ['--config', 'vite.theme.config.ts'],
  })

  try {
    await withPage(async (page) => {
      // 1. Forced light: the built-in palette ignores a dark OS preference.
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      const light = await styleOf(page, '.control', ['background-color', 'font-family'])
      assert.equal(light?.['background-color'], 'rgb(255, 255, 255)', 'mode=light was ignored')
      assert.match(light?.['font-family'] ?? '', /monospace/, 'the font token was not applied')

      // 2. A page variable is inherited through the shadow boundary, live.
      const pageStyle = await page.addStyleTag({
        content:
          ':root { --sphere-theme-bg: rgb(9, 8, 7); --sphere-theme-border: rgb(10, 11, 12); }',
      })

      const inherited = await styleOf(page, '.control', ['background-color'])
      assert.equal(
        inherited?.['background-color'],
        'rgb(9, 8, 7)',
        'a page --sphere-theme-* value did not reach the overlay',
      )

      // 3. The plugin option beats page CSS: inline style on the host wins.
      const precedence = await styleOf(page, '.control', ['border-top-color'])
      assert.equal(
        precedence?.['border-top-color'],
        'rgb(4, 5, 6)',
        'page CSS overrode a token from the plugin option',
      )

      // 4. Removing the page declaration restores the built-in fallback (still live).
      await page.evaluate(() => {
        const style = [...document.querySelectorAll('style')].find((node) =>
          node.textContent?.includes('--sphere-theme-bg'),
        )
        style?.remove()
      })

      const restored = await styleOf(page, '.control', ['background-color'])
      assert.equal(restored?.['background-color'], 'rgb(255, 255, 255)', 'the fallback was lost')
    })
  } finally {
    await server.stop()
  }

  console.log('theme: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

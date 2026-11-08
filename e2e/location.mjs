/**
 * Location honesty, in a browser: a verified line, a line found in the file, an enclosing line, and
 * an element Svelte never located.
 *
 *   node e2e/location.mjs
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { control, panel, startPicking, withPage } from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'
import { lineOf, promptFromClipboard, setRecordedLine } from './lib/location.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function pickAndCopy(page, selector) {
  await startPicking(page)
  await page.locator(selector).click()
  await panel(page).waitFor()
  await panel(page).getByRole('button', { name: 'Copy prompt' }).click()

  await panel(page).locator('.status').filter({ hasText: 'Copied' }).waitFor()

  return promptFromClipboard(page)
}

async function reset(page, origin) {
  await page.goto(origin)
  await page.locator('[data-testid="title"]').waitFor()
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('[data-testid="title"]').waitFor()
}

async function main() {
  const server = await startDevServer({ root })

  try {
    await withPage(async (page) => {
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      // 1. Verified: the recorded line opens the element, so it is reported with its column and
      //    without a note.
      const buttonLine = await lineOf(page, 'id="app-button"')
      const verified = await pickAndCopy(page, '#app-button')
      assert(
        verified.includes(`- markup: \`src/App.svelte:${buttonLine}:`),
        `expected a verified line ${buttonLine}, got:\n${verified}`,
      )
      assert(!verified.includes('- location note:'), 'a verified line grew a note')

      // 2. Matched: the compiler recorded an ancestor; the element is found by its class needle.
      await reset(page, server.origin)
      await setRecordedLine(page, '#app-button', 1)
      const matched = await pickAndCopy(page, '#app-button')

      assert(
        matched.includes(`- markup: \`src/App.svelte:${buttonLine}\``),
        `expected the matched line ${buttonLine}, got:\n${matched}`,
      )
      assert(
        matched.includes(
          '- location note: line matched by `class="button"`; Svelte recorded the enclosing element at `src/App.svelte:1`',
        ),
        `missing the matched note:\n${matched}`,
      )
      assert(!matched.includes(`:${buttonLine}:`), 'the matched line kept the ancestor column')

      // 3. Enclosing: nothing about the element appears in the file, so the recorded ancestor is
      //    reported as just that.
      await reset(page, server.origin)
      const paneLine = await lineOf(page, 'id="pane"')
      await page.evaluate(
        ({ paneLine }) => {
          const target = document.querySelector('#deep')
          if (!target?.__svelte_meta?.loc) throw new Error('#deep has no location')
          target.removeAttribute('id')
          target.className = ''
          target.textContent = 'anonymous'
          target.__svelte_meta.loc.line = paneLine
        },
        { paneLine },
      )

      const enclosing = await pickAndCopy(page, '#pane > div > p')
      assert(
        enclosing.includes(
          `- location note: \`src/App.svelte:${paneLine}\` is the enclosing element Svelte recorded; the element's own line was not found`,
        ),
        `missing the enclosing note:\n${enclosing}`,
      )

      // 4. `{@html}` produces elements Svelte never located. The inspection climbs to the nearest
      //    located ancestor (`docs/04` §1), so the prompt reports that ancestor and says so — it
      //    never claims the injected element's own line.
      await reset(page, server.origin)
      const hostLine = await lineOf(page, 'id="injected-host"')
      const injected = await pickAndCopy(page, '[data-testid="injected"]')

      assert(
        injected.includes(`- markup: \`src/App.svelte:${hostLine}\``),
        `expected the host line ${hostLine}, got:\n${injected}`,
      )
      assert(
        injected.includes(
          `- location note: \`src/App.svelte:${hostLine}\` is the enclosing element Svelte recorded; the element's own line was not found`,
        ),
        `missing the enclosing note for an injected element:\n${injected}`,
      )
      assert(injected.includes('- DOM path: `'), 'the prompt lost the DOM path')
      assert(
        injected.includes('Component chain (innermost first):'),
        'the chain should still exist',
      )

      // 5. The panel says which locations are approximate, with the same `~` the prompt implies.
      await reset(page, server.origin)
      await setRecordedLine(page, '#app-button', 1)
      await startPicking(page)
      await page.locator('#app-button').click()
      await panel(page).waitFor()

      const where = panel(page).locator('.pick .where').first()
      await where.waitFor()
      assert(
        ((await where.textContent()) ?? '').startsWith('~'),
        `no ~ on an approximate chip: ${await where.textContent()}`,
      )

      await control(page).click()
    })
  } finally {
    await server.stop()
  }

  console.log('location: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

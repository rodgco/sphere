/**
 * The panel is a part of the control, proved in a browser (`docs/06-toolbar-ux.md` §4).
 *
 * Placement is geometry the unit tests can compute, but only a real engine proves the result: the
 * panel's rendered height is its content, the control's box comes from the stylesheet, and a drag
 * is a pointer gesture. The failure this guards against is a panel placed from an estimated height:
 * it floats away from the pill and stays behind when the pill is dragged.
 *
 *   node e2e/panel.mjs
 */
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { panel, startPicking, withPage } from './lib/browser.mjs'
import { startDevServer } from './lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../fixtures/plain', import.meta.url)))

/** docs/06 §4: the panel sits this far from the pill, and this far from every viewport edge. */
const GAP = 10
const EDGE = 18
const VIEWPORT = { width: 1200, height: 800 }

/** The pill itself: `control` in the shared helpers is the Inspect button inside it. */
const pill = (page) => page.locator('.control')

/** A sub-pixel tolerance: the boxes are fractional, the constants are not. */
const near = (actual, expected, what) =>
  assert.ok(
    Math.abs(actual - expected) < 1,
    `${what}: expected ${expected}, got ${actual} (off by ${Math.abs(actual - expected).toFixed(1)})`,
  )

async function box(page, locator) {
  const found = await locator.boundingBox()
  assert.ok(found !== null, 'a box was expected')
  return found
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

async function main() {
  const server = await startDevServer({ root })

  try {
    await withPage(async (page) => {
      await page.goto(server.origin)
      await page.locator('[data-testid="title"]').waitFor()

      await startPicking(page)
      await page.locator('h2').first().click()
      await panel(page).waitFor()

      // 1. In the default corner the pill is in the lower half, so the panel opens above it,
      //    pinned by its own bottom edge: exactly GAP from the pill, whatever its content height.
      const corner = await box(page, pill(page))
      const first = await box(page, panel(page))
      near(first.y + first.height, corner.y - GAP, 'the panel is not GAP above the control')
      near(corner.y + corner.height, VIEWPORT.height - EDGE, 'the control is not in the corner')
      near(first.x + first.width, VIEWPORT.width - EDGE, 'the panel is not aligned to the right')

      // The dialog takes programmatic focus on a pick; a container must not paint the keyboard
      // ring for it, while its own controls keep theirs (`docs/06-toolbar-ux.md` §8).
      const dialogOutline = await panel(page).evaluate((el) => getComputedStyle(el).outlineStyle)
      assert.equal(dialogOutline, 'none', 'the dialog painted a focus ring on a pointer pick')

      await page.keyboard.press('Tab')
      const innerOutline = await panel(page)
        .locator('.panel-help')
        .evaluate((el) => getComputedStyle(el).outlineStyle)
      assert.equal(innerOutline, 'solid', 'a control inside the dialog lost its keyboard ring')

      // 2. Dragging the pill carries the panel: it flips below the control when the pill goes to
      //    the top, and keeps the same GAP on the other side.
      await drag(page, { x: corner.x + 20, y: corner.y + 18 }, { x: 200, y: 60 })

      const moved = await box(page, pill(page))
      const flipped = await box(page, panel(page))
      near(moved.y, 42, 'the control did not follow the drag')
      near(flipped.y, moved.y + moved.height + GAP, 'the panel did not flip below, GAP away')
      near(flipped.x, moved.x, 'the panel is not aligned to the left side of the control')

      // 3. Near the right edge the panel aligns to the other side and stays inside the viewport.
      await drag(
        page,
        { x: moved.x + 20, y: moved.y + 18 },
        { x: VIEWPORT.width - 40, y: moved.y + 18 },
      )

      const right = await box(page, pill(page))
      const aligned = await box(page, panel(page))
      // A drag is clamped to the viewport, not to the margin, so the pill reaches the edge; the
      // panel behind it keeps the 18 px margin.
      near(right.x + right.width, VIEWPORT.width, 'the control did not reach the right edge')
      near(aligned.x + aligned.width, VIEWPORT.width - EDGE, 'the panel left the right margin')
      near(aligned.y, right.y + right.height + GAP, 'the panel lost the gap on the right')

      // 4. Nothing of the panel is outside the viewport, on any side.
      assert.ok(aligned.x >= EDGE - 1, `the panel starts at ${aligned.x}`)
      assert.ok(
        aligned.y + aligned.height <= VIEWPORT.height - EDGE + 1,
        'the panel runs past the bottom margin',
      )
    })
  } finally {
    server.stop()
  }

  console.log('panel: ok')
}

await main()

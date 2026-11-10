/**
 * Captures the panel-geometry lab, so a review can be visual and reproducible.
 *
 * Writes PNGs to `.temp/lab/` (gitignored) — never to `docs/`, which only takes screenshots from
 * `scripts/screenshots/sphere.mjs` and its leak scan. The states are the ones
 * `docs/06-toolbar-ux.md` §4 describes: the 10 px gap, the flip when the pill approaches an edge,
 * the alignment to the control's side, and the panel inside the 18 px margin.
 *
 *   npm run lab        # the same page, to drive by hand
 *   npm run lab:shots  # these files
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startDevServer } from '../../e2e/lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../../fixtures/lab', import.meta.url)))
const out = resolve(fileURLToPath(new URL('../../.temp/lab', import.meta.url)))

const WIDE = { width: 1200, height: 800 }
const NARROW = { width: 460, height: 620 }

/** The pill, not the Inspect button inside it. */
const pill = (page) => page.locator('.control')
const panel = (page) => page.getByRole('dialog', { name: 'Build a prompt' })
const tiles = (page) => page.locator('.tile')

async function startPicking(page) {
  await page.locator('.inspect').click()
  await page.locator('.inspect[aria-pressed="true"]').waitFor()
}

/** Picking a tile opens the panel on the first one and keeps it for the rest. */
async function pick(page, ...indexes) {
  for (const index of indexes) await tiles(page).nth(index).click()
}

async function dragPill(page, to) {
  const from = await pill(page).boundingBox()
  if (from === null) throw new Error('lab: the pill has no box')

  // The label half of the pill: the count chip on the right is not a drag handle.
  const grip = { x: from.x + 20, y: from.y + from.height / 2 }

  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

async function shot(page, name) {
  const path = resolve(out, `${name}.png`)
  await page.screenshot({ path })
  console.log(`.temp/lab/${name}.png`)
}

async function main() {
  mkdirSync(out, { recursive: true })

  const server = await startDevServer({ root })
  /** Set when a second server (a different working directory) has to be stopped too. */
  let current = null
  const browser = await chromium.launch()
  const problems = []

  /** A page in its own context, so each capture can use its own viewport. */
  const capture = async (viewport, run) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('pageerror', (error) => problems.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })

    try {
      await page.goto(server.origin)
      await tiles(page).first().waitFor()
      await run(page)
    } finally {
      await context.close()
    }
  }

  try {
    // 1. The default corner: the pill is in the lower half, so the panel opens above it, pinned
    //    by its bottom edge exactly 10 px from the pill.
    await capture(WIDE, async (page) => {
      await startPicking(page)
      await pick(page, 0)
      await panel(page).waitFor()
      await shot(page, '01-corner-above')
    })

    // 2. A taller panel: more picks grow it downwards-away from the pill, and the gap stays.
    await capture(WIDE, async (page) => {
      await startPicking(page)
      await pick(page, 0, 1, 2, 3, 4, 5)
      await panel(page).waitFor()
      await shot(page, '02-taller-panel')
    })

    // 3. Dragged to the top-left: the panel flips below the pill and aligns to its left side.
    await capture(WIDE, async (page) => {
      await startPicking(page)
      await pick(page, 0)
      await panel(page).waitFor()
      await dragPill(page, { x: 48, y: 140 })
      await shot(page, '03-dragged-top-left')
    })

    // 4. Near the right edge: the panel aligns to the right and stops at the 18 px margin, 8 px
    //    inside a pill that was dragged to the edge.
    await capture(WIDE, async (page) => {
      await startPicking(page)
      await pick(page, 0)
      await panel(page).waitFor()
      await dragPill(page, { x: 1060, y: 320 })
      await shot(page, '04-right-edge')
    })

    // 5. A narrow viewport: the width, the height cap and the margin all shrink with it.
    await capture(NARROW, async (page) => {
      await startPicking(page)
      await pick(page, 0, 1, 2)
      await panel(page).waitFor()
      await shot(page, '05-narrow-viewport')
    })

    // 6. The way `npm run lab` starts it: from the repository root, so Svelte reports
    //    `fixtures/lab/src/App.svelte` while Vite's root is `fixtures/lab`. The chip must stay
    //    project-relative and verified (`docs/learning/svelte-internals.md` §11).
    const fromRoot = await startDevServer({
      root,
      cwd: resolve(root, '../..'),
      args: ['--config', resolve(root, 'vite.config.ts')],
    })
    current = fromRoot

    await capture(WIDE, async (page) => {
      await startPicking(page)
      await pick(page, 0)
      await panel(page).waitFor()
      await shot(page, '06-working-directory')
    })
  } finally {
    await browser.close()
    server.stop()
    current?.stop()
  }

  if (problems.length > 0) throw new Error(`page errors:\n${problems.join('\n')}`)

  console.log(`\nlab: 6 states captured in .temp/lab/ — open npm run lab to drive it by hand`)
}

await main()

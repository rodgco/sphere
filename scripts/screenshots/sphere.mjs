/**
 * Captures the README screenshots and refuses to write anything that leaks the machine.
 *
 * The overlay is a shadow root, so `page.textContent` is not enough: the scan walks the shadow
 * trees too, plus the attributes an operator might have pasted into the fixture. A hit fails the
 * run and writes no image, because a screenshot is published.
 *
 *   node scripts/screenshots/sphere.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startDevServer } from '../../e2e/lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../../fixtures/plain', import.meta.url)))
const images = resolve(fileURLToPath(new URL('../../docs/images', import.meta.url)))

const VIEWPORT = { width: 1200, height: 800 }
const INSTRUCTIONS = 'Turn this CTA into a solid primary button and keep the counter.'

/** Anything that would identify this machine or a credential. */
const FORBIDDEN = [
  /\/home\//,
  /\/Users\//,
  homedir(),
  /gho_[A-Za-z0-9]+/,
  /ghp_[A-Za-z0-9]+/,
  /npm_[A-Za-z0-9]{10,}/,
  /BEGIN [A-Z ]*PRIVATE KEY/,
]

function assertNoLeak(text, where) {
  for (const pattern of FORBIDDEN) {
    if (typeof pattern === 'string') {
      if (pattern !== '' && text.includes(pattern)) throw new Error(`${where}: leaked ${pattern}`)
      continue
    }
    const match = pattern.exec(text)
    if (match !== null) throw new Error(`${where}: leaked ${match[0]}`)
  }
}

/**
 * What a reader of the screenshot could actually see: text nodes, plus the attributes that render
 * as text (tooltips, labels, placeholders). Shadow roots included, because the overlay lives in
 * one. Svelte's dev `<style data-…="…/App.svelte">` is an implementation detail of the dev server,
 * not something the image shows.
 */
const VISIBLE_ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'value']

async function visibleText(page) {
  return page.evaluate((visible) => {
    const walk = (node) => {
      let text = ''
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? ''
      if (node.nodeType === Node.ELEMENT_NODE) {
        for (const name of visible) {
          const value = node.getAttribute(name)
          if (value !== null) text += ` ${value}`
        }
      }
      for (const child of node.childNodes) text += walk(child)
      if (node.shadowRoot) text += walk(node.shadowRoot)
      return text
    }
    return walk(document.documentElement)
  }, VISIBLE_ATTRIBUTES)
}

async function capture(browser, origin, scheme) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: scheme })
  const page = await context.newPage()

  await page.goto(origin)
  await page.locator('[data-testid="title"]').waitFor()

  await page.locator('.inspect').click()
  await page.locator('#app-link').click()
  await page.locator('.card').first().click()
  await page.getByRole('dialog', { name: 'Build a prompt' }).waitFor()
  await page.getByRole('textbox', { name: 'Instructions' }).fill(INSTRUCTIONS)

  // Park the pointer so no hover outline or tooltip is captured.
  await page.mouse.move(4, 4)
  await page.waitForTimeout(80)

  const text = await visibleText(page)
  assertNoLeak(text, `${scheme} page`)

  mkdirSync(images, { recursive: true })
  const file = resolve(images, `sphere-${scheme}.png`)
  await page.screenshot({ path: file, fullPage: false })

  await context.close()
  return { file, text }
}

async function main() {
  const server = await startDevServer({ root })
  const browser = await chromium.launch()

  try {
    const shots = []
    for (const scheme of ['light', 'dark']) {
      const shot = await capture(browser, server.origin, scheme)
      shots.push({
        theme: scheme,
        file: shot.file.replace(`${images}/`, 'docs/images/'),
        viewport: `${VIEWPORT.width}×${VIEWPORT.height}`,
        leaks: 0,
      })
    }

    const manifest = {
      commit: execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(),
      captured: new Date().toISOString(),
      runner: `${process.platform} ${process.arch}`,
      viewport: `${VIEWPORT.width}×${VIEWPORT.height}`,
      shots,
    }

    writeFileSync(resolve(images, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`screenshots: ${shots.map((shot) => shot.file).join(', ')}`)
  } finally {
    await browser.close()
    await server.stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

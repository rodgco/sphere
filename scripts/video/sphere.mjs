/**
 * Records a short demo of Sphere on the plain Vite fixture.
 *
 *   node scripts/video/sphere.mjs
 *
 * Playwright records `docs/videos/sphere-demo.webm`; ffmpeg converts it to H.264 MP4 for players
 * that do not take WebM. The cursor is a page overlay because Playwright's video does not capture
 * the OS pointer.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startDevServer } from '../../e2e/lib/dev-server.mjs'

const root = resolve(fileURLToPath(new URL('../../fixtures/plain', import.meta.url)))
const outDir = resolve(fileURLToPath(new URL('../../docs/videos', import.meta.url)))
const outFile = resolve(outDir, 'sphere-demo.mp4')
const VIEWPORT = { width: 1280, height: 800 }
const INSTRUCTIONS = 'Turn this CTA into a solid primary button and keep the counter.'

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds))

/** A visible dot, because the recorded page has no OS cursor. */
async function addDemoCursor(page) {
  await page.evaluate(() => {
    const cursor = document.createElement('div')
    cursor.setAttribute('aria-hidden', 'true')
    cursor.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 20px',
      'height: 20px',
      'border-radius: 50%',
      'border: 2px solid #2563eb',
      'background: rgba(37, 99, 235, 0.2)',
      'box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12)',
      'pointer-events: none',
      'z-index: 2147483647',
      'transform: translate(-50%, -50%)',
      'transition: width 120ms ease, height 120ms ease, background 120ms ease',
    ].join(';')

    document.documentElement.append(cursor)

    window.addEventListener(
      'pointermove',
      (event) => {
        cursor.style.left = `${event.clientX}px`
        cursor.style.top = `${event.clientY}px`
      },
      true,
    )
    window.addEventListener(
      'pointerdown',
      () => {
        cursor.style.width = '30px'
        cursor.style.height = '30px'
        cursor.style.background = 'rgba(37, 99, 235, 0.35)'
      },
      true,
    )
    window.addEventListener(
      'pointerup',
      () => {
        cursor.style.width = '20px'
        cursor.style.height = '20px'
        cursor.style.background = 'rgba(37, 99, 235, 0.2)'
      },
      true,
    )
  })
}

async function clickAt(page, locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('video: target is not visible')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
  await wait(350)
  await page.mouse.down()
  await wait(90)
  await page.mouse.up()
  await wait(450)
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const temp = mkdtempSync(join(tmpdir(), 'sphere-video-'))
  const server = await startDevServer({ root })
  const browser = await chromium.launch()

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'light',
      recordVideo: { dir: temp, size: VIEWPORT },
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    const page = await context.newPage()
    const video = page.video()

    await page.goto(server.origin)
    await page.locator('[data-testid="title"]').waitFor()
    await addDemoCursor(page)
    await page.mouse.move(1100, 700)
    await wait(900)

    const inspect = page.locator('.inspect')
    await clickAt(page, inspect)

    // Hover first, so the outline and the source tooltip are visible before the pick.
    const link = page.locator('#app-link')
    await link.hover()
    await wait(900)
    await clickAt(page, link)

    const button = page.locator('#app-button')
    await button.hover()
    await wait(600)
    await clickAt(page, button)

    const card = page.locator('.card').first()
    await card.hover()
    await wait(600)
    await clickAt(page, card)

    const instructions = page.getByRole('textbox', { name: 'Instructions' })
    await clickAt(page, instructions)
    await page.keyboard.type(INSTRUCTIONS, { delay: 22 })
    await wait(500)

    const copy = page.getByRole('button', { name: 'Copy prompt' })
    await clickAt(page, copy)

    // Let the copied-status line sit on screen.
    await page.mouse.move(1160, 700, { steps: 8 })
    await wait(1_800)

    const webm = await video.path()
    await context.close()
    await page.close()

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        webm,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-an',
        outFile,
      ],
      { stdio: 'ignore' },
    )

    const size = statSync(outFile).size
    console.log(`video: ${outFile} (${(size / 1024 / 1024).toFixed(2)} MB)`)
  } finally {
    await browser.close()
    await server.stop()
    rmSync(temp, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

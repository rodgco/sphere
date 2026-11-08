import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Overlay from '../../src/overlay/Overlay.svelte'
import Single from '../../fixtures/harness/Single.svelte'
import { groupDigits } from '../../src/overlay/clipboard.js'

function giveRect(
  element: Element,
  box: { top: number; left: number; width: number; height: number },
) {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      right: box.left + box.width,
      bottom: box.top + box.height,
      x: box.left,
      y: box.top,
      toJSON: () => ({}),
    }) as DOMRect
}

function event(target: EventTarget, type: string, init: MouseEventInit | KeyboardEventInit = {}) {
  const created =
    type === 'keydown'
      ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
      : new MouseEvent(type, { bubbles: true, cancelable: true, ...init })

  target.dispatchEvent(created)
  flushSync()
  return created
}

/** The copy path awaits the clipboard; let its microtasks (and one task) finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function mountOverlay() {
  const app = document.createElement('div')
  app.innerHTML =
    '<a id="link" class="cta" href="/next"><span>go</span></a><button id="counter">count</button>'
  document.body.append(app)

  for (const [index, element] of [...app.querySelectorAll('a, button')].entries()) {
    giveRect(element, { top: 10 + index * 40, left: 20, width: 100, height: 24 })
  }

  const target = document.createElement('div')
  document.body.append(target)
  const instance = mount(Overlay, { target })
  flushSync()

  const control = target.querySelector<HTMLButtonElement>('.inspect')!
  const copy = () =>
    [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Copy prompt',
    )!

  return {
    app,
    target,
    control,
    copy,
    startPicking() {
      event(control, 'pointerdown', { button: 0 })
      event(window, 'pointerup', { button: 0 })
    },
    pick(id: string) {
      event(document.getElementById(id)!, 'pointerdown', { button: 0 })
    },
    pickElement(element: Element) {
      const box = { top: 10, left: 20, width: 100, height: 24 }
      giveRect(element, box)
      event(element, 'pointerdown', { button: 0 })
    },
    type(text: string) {
      const textarea = target.querySelector<HTMLTextAreaElement>('textarea')!
      textarea.value = text
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
    },
    status() {
      return target.querySelector('.status')?.textContent?.trim() ?? ''
    },
    destroy() {
      unmount(instance)
      target.remove()
      app.remove()
    },
  }
}

let written: string[] = []

beforeEach(() => {
  localStorage.clear()
  written = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('copying the prompt', () => {
  it('writes a complete document for the picks and reports its size', async () => {
    // A real Svelte component, so the prompt has a location and a component chain to prove.
    const svelteHost = document.createElement('div')
    document.body.append(svelteHost)
    const app = mount(Single, { target: svelteHost })
    flushSync()

    const view = mountOverlay()
    try {
      view.startPicking()
      view.pickElement(svelteHost.querySelector('[data-testid="single"]')!)
      view.type('Make this button square.')

      event(view.copy(), 'click', { detail: 1 })
      await settle()

      expect(written).toHaveLength(1)
      const prompt = written[0]!

      expect(
        prompt.startsWith('# UI context from the running app\n\nPage: `http://localhost:3000/'),
      ).toBe(true)
      expect(prompt).toContain('## What I need\n\nMake this button square.')
      expect(prompt).toContain('### Selected element section.single')
      expect(prompt).toContain(
        '```html\n<section class="single" data-testid="single"><h2></h2><p></p></section>\n```',
      )
      expect(prompt).toContain('- markup: `')
      expect(prompt).toContain('Component chain (innermost first):\n1. Single — `')
      expect(view.status()).toBe(`Copied ${groupDigits(prompt.length)} chars`)
      // No rendered text, and no machine path beyond the component file the tool reports.
      expect(prompt).not.toContain('One element at the root.')
      expect(prompt).not.toMatch(/\/home\/[^`\s]+/)
      // Copying ends picking.
      expect(view.control.getAttribute('aria-pressed')).toBe('false')
    } finally {
      view.destroy()
      unmount(app)
      svelteHost.remove()
    }
  })

  it('writes one block per pick, in pick order, separated by a rule', async () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.pick('link')
      view.pick('counter')

      event(view.copy(), 'click', { detail: 1 })
      await settle()

      const prompt = written[0]!
      expect(prompt.indexOf('### Selected element a#link.cta')).toBeLessThan(
        prompt.indexOf('### Selected element button#counter'),
      )
      expect(prompt).toMatch(/\n---\n\n### Selected element button#counter/)
    } finally {
      view.destroy()
    }
  })

  it('falls back to the legacy copy path when the async API is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
    const exec = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })

    const view = mountOverlay()
    try {
      view.startPicking()
      view.pick('link')
      event(view.copy(), 'click', { detail: 1 })
      await settle()

      expect(exec).toHaveBeenCalledWith('copy')
      expect(view.status()).toMatch(/^Copied \d/)
    } finally {
      view.destroy()
    }
  })

  it('says so when the clipboard cannot be written', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false })

    const view = mountOverlay()
    try {
      view.startPicking()
      view.pick('link')
      event(view.copy(), 'click', { detail: 1 })
      await settle()

      expect(view.status()).toBe('Could not write to the clipboard.')
      expect(view.target.querySelector('.status')?.classList.contains('error')).toBe(true)
      // A failed copy does not silently end picking.
      expect(view.control.getAttribute('aria-pressed')).toBe('true')
    } finally {
      view.destroy()
    }
  })

  it('disables Copy prompt until there is something to copy', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      // No picks yet: the panel is not even open, so open it from the control-less path.
      expect(view.copy()).toBeUndefined()

      view.pick('link')
      expect(view.copy().disabled).toBe(false)
    } finally {
      view.destroy()
    }
  })
})

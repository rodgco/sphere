import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Overlay from '../../src/overlay/Overlay.svelte'
import Single from '../../fixtures/harness/Single.svelte'
import { OPTIONS_KEY } from '../../src/overlay/storage.js'

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
  const isKey = type === 'keydown'
  const created = isKey
    ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
    : new MouseEvent(type, { bubbles: true, cancelable: true, ...init })

  target.dispatchEvent(created)
  flushSync()
  return created
}

function mountOverlay(count = 2) {
  const app = document.createElement('div')
  app.innerHTML = Array.from(
    { length: count },
    (_, index) => `<a id="e${index}" class="cta" href="/next">link ${index}</a>`,
  ).join('')
  document.body.append(app)

  for (const [index, element] of [...app.querySelectorAll('a')].entries()) {
    giveRect(element, { top: 10 + index * 40, left: 20, width: 100, height: 24 })
  }

  const target = document.createElement('div')
  document.body.append(target)
  const instance = mount(Overlay, { target })
  flushSync()

  const control = target.querySelector<HTMLButtonElement>('.inspect')!
  const panel = () => target.querySelector<HTMLElement>('[role="dialog"]')
  const chip = () => target.querySelector<HTMLButtonElement>('.chip')

  return {
    app,
    target,
    control,
    panel,
    chip,
    pick(index: number) {
      event(document.getElementById(`e${index}`)!, 'pointerdown', { button: 0 })
    },
    startPicking() {
      event(control, 'pointerdown', { button: 0 })
      event(window, 'pointerup', { button: 0 })
    },
    destroy() {
      unmount(instance)
      target.remove()
      app.remove()
    },
  }
}

let view: ReturnType<typeof mountOverlay>

beforeEach(() => {
  localStorage.clear()
})

describe('the panel', () => {
  it('opens on a pick, as a labelled dialog, with focus in the instructions', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)

      const panel = view.panel()
      expect(panel?.getAttribute('aria-label')).toBe('Build a prompt')
      expect(document.activeElement).toBe(panel?.querySelector('textarea'))
    } finally {
      view.destroy()
    }
  })

  it('lists picks with number, label and location, and the status line narrates', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)
      view.pick(1)

      const entries = [...view.target.querySelectorAll('.pick')]
      expect(entries).toHaveLength(2)
      expect(entries[0]?.textContent).toContain('1')
      expect(entries[0]?.textContent).toContain('a#e0.cta')
      expect(view.target.querySelector('.status')?.textContent?.trim()).toBe('Added a')
    } finally {
      view.destroy()
    }
  })

  it('removes a pick, renumbers the rest and says so', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)
      view.pick(1)

      const removeSecond = view.target.querySelectorAll<HTMLButtonElement>('.remove')[0]!
      event(removeSecond, 'click', { detail: 1 })

      const entries = [...view.target.querySelectorAll('.pick')]
      expect(entries).toHaveLength(1)
      expect(entries[0]?.textContent).toContain('1')
      expect(entries[0]?.textContent).toContain('a#e1.cta')
      expect(view.target.querySelector('.status')?.textContent?.trim()).toBe('Removed a')
    } finally {
      view.destroy()
    }
  })

  it('reports the cap with words, not only with a missing mark', () => {
    view = mountOverlay(11)
    try {
      view.startPicking()
      for (let index = 0; index < 11; index += 1) view.pick(index)

      const status = view.target.querySelector('.status')
      expect(status?.textContent?.trim()).toBe('At most 10 elements per prompt.')
      expect(status?.classList.contains('error')).toBe(true)
      expect(view.target.querySelectorAll('.pick')).toHaveLength(10)
    } finally {
      view.destroy()
    }
  })

  it('keeps the instructions across close and open, and Clear empties the form', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)

      const textarea = view.target.querySelector<HTMLTextAreaElement>('textarea')!
      textarea.value = 'make the button square'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()

      event(view.chip()!, 'click', { detail: 1 })
      expect(view.panel()).toBeNull()

      event(view.chip()!, 'click', { detail: 1 })
      expect(view.target.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
        'make the button square',
      )

      const clear = [...view.target.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Clear',
      )!
      event(clear, 'click', { detail: 1 })

      expect(view.target.querySelectorAll('.pick')).toHaveLength(0)
      expect(view.target.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('')
      expect(view.target.querySelector('.status')?.textContent?.trim()).toBe('Cleared the prompt.')
    } finally {
      view.destroy()
    }
  })

  it('shows the empty state and keeps the chip in sync', () => {
    view = mountOverlay()
    try {
      expect(view.chip()).toBeNull()

      view.startPicking()
      view.pick(0)

      expect(view.chip()?.textContent?.trim()).toBe('1 picked')
      expect(view.chip()?.getAttribute('aria-expanded')).toBe('true')

      event(view.chip()!, 'click', { detail: 1 })
      expect(view.panel()).toBeNull()
      expect(view.chip()?.getAttribute('aria-expanded')).toBe('false')
    } finally {
      view.destroy()
    }
  })

  it('persists the option toggles', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)

      const state = view.target.querySelector<HTMLInputElement>('input[type="checkbox"]')!
      expect(state.checked).toBe(true)

      state.checked = false
      state.dispatchEvent(new Event('change', { bubbles: true }))
      flushSync()

      expect(JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}')).toMatchObject({ state: false })
    } finally {
      view.destroy()
    }
  })

  it('replaces the raw location with the resolved one on the chip', async () => {
    // A real Svelte element: the harness app is HTML, so it has no location at all.
    const svelteHost = document.createElement('div')
    document.body.append(svelteHost)
    const app = mount(Single, { target: svelteHost })
    flushSync()

    view = mountOverlay()
    try {
      view.startPicking()
      event(svelteHost.querySelector('[data-testid="single"]')!, 'pointerdown', { button: 0 })

      // The harness can read its own files, so a verified location must lose the `~` the raw
      // location starts with (`$state` proxies the pick array; the update must still land).
      await vi.waitFor(() => {
        const where = view.target.querySelector('.pick .where')?.textContent ?? ''
        expect(where).not.toMatch(/^~/)
        expect(where).toMatch(/:\d+$/)
      })
    } finally {
      view.destroy()
      unmount(app)
      svelteHost.remove()
    }
  })

  it('keeps the app out of its typing, but lets Escape through', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)

      const seen: string[] = []
      const watcher = (pressed: KeyboardEvent) => seen.push(pressed.key)
      document.addEventListener('keydown', watcher)

      const textarea = view.target.querySelector<HTMLTextAreaElement>('textarea')!
      event(textarea, 'keydown', { key: 'k' })
      expect(seen).toEqual([])

      event(textarea, 'keydown', { key: 'Escape' })
      expect(seen).toEqual(['Escape'])

      document.removeEventListener('keydown', watcher)
    } finally {
      view.destroy()
    }
  })

  it('closes on Escape and gives focus back to the control', () => {
    view = mountOverlay()
    try {
      view.startPicking()
      view.pick(0)
      expect(view.panel()).not.toBeNull()

      event(window, 'keydown', { key: 'Escape' })

      expect(view.panel()).toBeNull()
      expect(document.activeElement).toBe(view.control)
      expect(view.control.getAttribute('aria-pressed')).toBe('false')
    } finally {
      view.destroy()
    }
  })
})

import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import Overlay from '../../src/overlay/Overlay.svelte'
import { CONTROL_KEY, writeControl } from '../../src/overlay/storage.js'

function mountOverlay() {
  const target = document.createElement('div')
  document.body.append(target)
  const app = mount(Overlay, { target })
  // `onMount` and `$effect` run in a microtask; the listeners exist after a flush.
  flushSync()

  const shell = target.querySelector<HTMLDivElement>('.control')
  const control = target.querySelector<HTMLButtonElement>('.inspect')

  if (!shell || !control) throw new Error('overlay: no control rendered')

  return {
    shell,
    control,
    destroy() {
      unmount(app)
      target.remove()
    },
  }
}

// Svelte batches DOM updates: every assertion about rendered state needs a flush.
function pointer(target: EventTarget, type: string, x: number, y: number) {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  )
  flushSync()
}

function pressKey(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  flushSync()
}

function click(target: EventTarget, detail: number) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
  flushSync()
}

const pressed = (control: HTMLButtonElement) => control.getAttribute('aria-pressed')

beforeEach(() => {
  localStorage.clear()
  document.documentElement.style.cursor = ''
})

describe('the control', () => {
  it('is a button named Inspect that starts unpressed', () => {
    const view = mountOverlay()
    try {
      expect(view.control.tagName).toBe('BUTTON')
      expect(view.control.textContent?.trim()).toBe('Inspect')
      expect(pressed(view.control)).toBe('false')
      expect(view.control.getAttribute('type')).toBe('button')
    } finally {
      view.destroy()
    }
  })

  it('toggles picking on a primary click and gives the page one cursor', () => {
    const view = mountOverlay()
    try {
      pointer(view.control, 'pointerdown', 10, 10)
      pointer(window, 'pointerup', 10, 10)

      expect(pressed(view.control)).toBe('true')
      expect(document.documentElement.style.cursor).toBe('crosshair')

      pointer(view.control, 'pointerdown', 10, 10)
      pointer(window, 'pointerup', 10, 10)

      expect(pressed(view.control)).toBe('false')
      expect(document.documentElement.style.cursor).toBe('')
    } finally {
      view.destroy()
    }
  })

  it('toggles from the keyboard, and ignores the mouse click that follows a pointer gesture', () => {
    const view = mountOverlay()
    try {
      click(view.control, 0)
      expect(pressed(view.control)).toBe('true')

      // A mouse click (detail 1) arriving on its own must not toggle: pointerup decides.
      click(view.control, 1)
      expect(pressed(view.control)).toBe('true')
    } finally {
      view.destroy()
    }
  })

  it('drags the pill, persists the position and does not toggle', () => {
    const view = mountOverlay()
    try {
      pointer(view.control, 'pointerdown', 10, 10)
      pointer(window, 'pointermove', 90, 50)
      pointer(window, 'pointerup', 90, 50)

      expect(pressed(view.control)).toBe('false')
      expect(view.shell.style.left).toBe('80px')
      expect(view.shell.style.top).toBe('40px')
      expect(JSON.parse(localStorage.getItem(CONTROL_KEY) ?? 'null')).toEqual({ x: 80, y: 40 })
    } finally {
      view.destroy()
    }
  })

  it('treats a wobble under the threshold as a click', () => {
    const view = mountOverlay()
    try {
      pointer(view.control, 'pointerdown', 10, 10)
      pointer(window, 'pointermove', 13, 12)
      pointer(window, 'pointerup', 13, 12)

      expect(pressed(view.control)).toBe('true')
      expect(localStorage.getItem(CONTROL_KEY)).toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('draws the focus ring for the keyboard, never for a pointer', () => {
    const view = mountOverlay()
    try {
      // A primary click focuses the pill (docs/06 §1) but must not paint a ring: Chromium would
      // report :focus-visible here, which is why the modality is tracked by hand.
      pointer(view.control, 'pointerdown', 10, 10)
      pointer(window, 'pointerup', 10, 10)
      expect(view.shell.classList.contains('focus-ring')).toBe(false)

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      view.control.focus()
      flushSync()

      expect(view.shell.classList.contains('focus-ring')).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('returns to the default corner on double click', () => {
    const view = mountOverlay()
    writeControl({ x: 200, y: 120 })
    try {
      view.control.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))

      expect(view.shell.style.left).toBe('')
      expect(localStorage.getItem(CONTROL_KEY)).toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('leaves picking on Escape and restores the cursor', () => {
    const view = mountOverlay()
    try {
      click(view.control, 0)
      pressKey(window, 'Escape')

      expect(pressed(view.control)).toBe('false')
      expect(document.documentElement.style.cursor).toBe('')
    } finally {
      view.destroy()
    }
  })

  it('restores a stored position on mount', () => {
    writeControl({ x: 210, y: 130 })

    const view = mountOverlay()
    try {
      // `onMount` reads storage once; Svelte applies it before the first paint we can observe.
      expect(view.shell.style.left).toBe('210px')
      expect(view.shell.style.top).toBe('130px')
    } finally {
      view.destroy()
    }
  })
})

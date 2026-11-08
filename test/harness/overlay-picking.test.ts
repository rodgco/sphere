import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import Overlay from '../../src/overlay/Overlay.svelte'

/** happy-dom has no layout: every element is 0×0, so the tests give the app elements a box. */
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

function pointer(target: EventTarget, type: string, init: MouseEventInit = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  flushSync()
  return event
}

function mountOverlay() {
  const app = document.createElement('div')
  app.innerHTML =
    '<a id="link" href="/next" class="cta"><span>go</span></a><p id="text">hello</p><button id="second">b</button>'
  document.body.append(app)

  const target = document.createElement('div')
  document.body.append(target)
  const instance = mount(Overlay, { target })
  flushSync()

  for (const [index, element] of [...app.querySelectorAll('a, p, button')].entries()) {
    giveRect(element, { top: 10 + index * 50, left: 20, width: 120, height: 30 })
  }

  const control = target.querySelector<HTMLButtonElement>('.control')!
  const marks = () => [...target.querySelectorAll('.mark')] as HTMLElement[]

  return {
    app,
    target,
    control,
    marks,
    destroy() {
      unmount(instance)
      target.remove()
      app.remove()
    },
  }
}

const enterPicking = (control: HTMLButtonElement) => {
  pointer(control, 'pointerdown', { button: 0 })
  pointer(window, 'pointerup', { button: 0 })
}

beforeEach(() => {
  localStorage.clear()
})

describe('picking in the overlay', () => {
  it('outlines what is under the pointer with tag and location', () => {
    const view = mountOverlay()
    try {
      enterPicking(view.control)
      pointer(document.getElementById('link')!, 'pointermove', { clientX: 10, clientY: 20 })

      const tooltip = view.target.querySelector('.tooltip')
      expect(tooltip?.textContent ?? '').toMatch(/^a/)
      expect(view.target.querySelector('.hover-outline')).not.toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('picks on pointerdown, keeps picking, and numbers the marks', () => {
    const view = mountOverlay()
    try {
      enterPicking(view.control)

      pointer(document.getElementById('link')!, 'pointerdown', { button: 0 })
      pointer(document.getElementById('second')!, 'pointerdown', { button: 0 })

      expect(view.control.getAttribute('aria-pressed')).toBe('true')
      expect(view.marks()).toHaveLength(2)
      expect(view.marks()[0]?.textContent).toBe('1')
    } finally {
      view.destroy()
    }
  })

  it('unpicks the same element and renumbers the rest', () => {
    const view = mountOverlay()
    try {
      enterPicking(view.control)
      pointer(document.getElementById('link')!, 'pointerdown', { button: 0 })
      pointer(document.getElementById('second')!, 'pointerdown', { button: 0 })
      pointer(document.getElementById('link')!, 'pointerdown', { button: 0 })

      expect(view.marks()).toHaveLength(1)
      expect(view.marks()[0]?.textContent).toBe('1')
    } finally {
      view.destroy()
    }
  })

  it('stops at the cap without dropping picks', () => {
    const view = mountOverlay()
    try {
      view.app.innerHTML = Array.from({ length: 12 }, (_, index) => `<i id="e${index}">x</i>`).join(
        '',
      )
      for (const [index, element] of [...view.app.querySelectorAll('i')].entries()) {
        giveRect(element, { top: 10 + index * 20, left: 20, width: 40, height: 10 })
      }
      enterPicking(view.control)

      for (let index = 0; index < 12; index += 1) {
        pointer(document.getElementById(`e${index}`)!, 'pointerdown', { button: 0 })
      }

      expect(view.marks()).toHaveLength(10)
    } finally {
      view.destroy()
    }
  })

  it('drops the hover outline when an element is picked', () => {
    const view = mountOverlay()
    try {
      enterPicking(view.control)
      const link = document.getElementById('link')!
      pointer(link, 'pointermove', { clientX: 5, clientY: 5 })
      expect(view.target.querySelector('.hover-outline')).not.toBeNull()

      pointer(link, 'pointerdown', { button: 0 })
      pointer(link, 'pointermove', { clientX: 5, clientY: 5 })
      expect(view.target.querySelector('.hover-outline')).toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('leaves picking on Escape and lets the page work again', () => {
    const view = mountOverlay()
    try {
      enterPicking(view.control)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()

      expect(view.control.getAttribute('aria-pressed')).toBe('false')
      expect(view.target.querySelector('.hover-outline')).toBeNull()
      // Marks stay: a pick is not a selection of the picking mode.
      expect(
        pointer(document.getElementById('second')!, 'pointerdown', { button: 0 }).defaultPrevented,
      ).toBe(false)
    } finally {
      view.destroy()
    }
  })
})

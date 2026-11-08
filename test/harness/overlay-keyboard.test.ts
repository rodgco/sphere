import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import Overlay from '../../src/overlay/Overlay.svelte'

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

function mountOverlay() {
  // A fill layer that covers the button: the pointer can only reach the button.
  const app = document.createElement('div')
  app.innerHTML = `
    <main id="app-main">
      <div id="fill" style="position:absolute;inset:0">
        <button id="inner">inside</button>
      </div>
      <aside id="side">side</aside>
    </main>`
  document.body.append(app)

  giveRect(app.querySelector('#app-main')!, { top: 0, left: 0, width: 600, height: 400 })
  giveRect(app.querySelector('#fill')!, { top: 0, left: 0, width: 600, height: 400 })
  giveRect(app.querySelector('#inner')!, { top: 10, left: 10, width: 100, height: 30 })
  giveRect(app.querySelector('#side')!, { top: 0, left: 620, width: 100, height: 400 })

  const target = document.createElement('div')
  document.body.append(target)
  const instance = mount(Overlay, { target })
  flushSync()

  const control = target.querySelector<HTMLButtonElement>('.inspect')!

  return {
    app,
    target,
    control,
    marks: () => target.querySelectorAll('.mark').length,
    tooltip: () => target.querySelector('.tooltip')?.textContent?.trim() ?? null,
    outline: () => target.querySelector('.hover-outline') !== null,
    startPicking() {
      event(control, 'pointerdown', { button: 0 })
      event(window, 'pointerup', { button: 0 })
    },
    click(selector: string) {
      event(document.querySelector(selector)!, 'pointerdown', { button: 0 })
    },
    destroy() {
      unmount(instance)
      target.remove()
      app.remove()
    },
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('keyboard selection while picking', () => {
  it('works before the first pick', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      expect(view.marks()).toBe(0)

      // Nothing hovered, nothing picked: the first key starts from the page's own content and
      // descends: app root → main → the header.
      event(window, 'keydown', { key: 's' })
      expect(view.outline()).toBe(true)
      expect(view.tooltip()).toMatch(/^main/)

      event(window, 'keydown', { key: 's' })
      const header = view.tooltip()
      expect(header).not.toMatch(/^main/)

      event(window, 'keydown', { key: 'd' })
      expect(view.tooltip()).not.toBe(header)
    } finally {
      view.destroy()
    }
  })

  it('picks the outlined element on click, not the one under the pointer', () => {
    const view = mountOverlay()
    try {
      view.startPicking()

      // Hover the button, widen to the fill layer that covers it, then click elsewhere: the click
      // confirms what is outlined.
      event(document.querySelector('#inner')!, 'pointermove', { clientX: 12, clientY: 12 })
      event(window, 'keydown', { key: 'w' })
      expect(view.tooltip()).toMatch(/^div/)

      event(document.querySelector('#side')!, 'pointermove', { clientX: 640, clientY: 20 })
      expect(view.tooltip()).toMatch(/^div/)

      event(document.querySelector('#side')!, 'pointerdown', { button: 0 })
      expect(view.marks()).toBe(1)

      const label = view.target.querySelector('.pick .name')?.textContent ?? ''
      expect(label).toBe('div#fill')
    } finally {
      view.destroy()
    }
  })

  it('gives the selection back to the pointer after a click', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      event(document.querySelector('#inner')!, 'pointermove', { clientX: 12, clientY: 12 })
      event(window, 'keydown', { key: 'w' })
      event(document.querySelector('#side')!, 'pointerdown', { button: 0 })

      event(document.querySelector('#inner')!, 'pointermove', { clientX: 12, clientY: 12 })
      expect(view.tooltip()).toMatch(/^button/)
    } finally {
      view.destroy()
    }
  })

  it('widens to a container that the pointer cannot reach, and picks it with Enter', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.click('#inner')
      expect(view.marks()).toBe(1)

      // `w` walks to the fill layer that sits on top of the button.
      const widened = event(window, 'keydown', { key: 'w' })
      expect(widened.defaultPrevented).toBe(true)
      expect(view.outline()).toBe(true)
      expect(view.tooltip()).toMatch(/^div/)

      event(window, 'keydown', { key: 'Enter' })
      expect(view.marks()).toBe(2)

      // Backspace undoes the last pick, in pick order.
      event(window, 'keydown', { key: 'Backspace' })
      expect(view.marks()).toBe(1)
    } finally {
      view.destroy()
    }
  })

  it('walks siblings and children, and swallows the keys it handles', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.click('#fill')

      // Children: the fill layer's first element child is the button.
      event(window, 'keydown', { key: 'ArrowDown' })
      expect(view.tooltip()).toMatch(/^button/)

      // Back up, then across to the sibling aside.
      event(window, 'keydown', { key: 'w' })
      event(window, 'keydown', { key: 'd' })
      expect(view.tooltip()).toMatch(/^aside/)

      const space = event(window, 'keydown', { key: ' ' })
      expect(space.defaultPrevented).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('leaves other keys and modifiers to the page', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.click('#inner')

      const typed = event(window, 'keydown', { key: 'k' })
      expect(typed.defaultPrevented).toBe(false)

      const shortcut = event(window, 'keydown', { key: 'w', altKey: true })
      expect(shortcut.defaultPrevented).toBe(false)
    } finally {
      view.destroy()
    }
  })

  it('leaves picking on Escape even from inside the instruction box', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.click('#inner')

      const textarea = view.target.querySelector<HTMLTextAreaElement>('textarea')!
      textarea.focus()
      event(textarea, 'keydown', { key: 'Escape' })

      expect(view.control.getAttribute('aria-pressed')).toBe('false')
    } finally {
      view.destroy()
    }
  })

  it('does not navigate while the user types in the panel', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.click('#inner')
      event(window, 'keydown', { key: 'w' })
      const widened = view.tooltip()

      const textarea = view.target.querySelector<HTMLTextAreaElement>('textarea')!
      textarea.focus()
      const typed = event(textarea, 'keydown', { key: 'd' })

      expect(typed.defaultPrevented).toBe(false)
      expect(view.tooltip()).toBe(widened)
    } finally {
      view.destroy()
    }
  })
})

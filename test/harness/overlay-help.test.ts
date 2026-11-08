import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import Overlay from '../../src/overlay/Overlay.svelte'
import { SHORTCUTS } from '../../src/overlay/keyboard.js'

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
  const app = document.createElement('div')
  app.innerHTML = `
    <main id="app-main">
      <div id="fill"><button id="inner">inside</button></div>
      <aside id="side">side</aside>
    </main>`
  document.body.append(app)

  giveRect(app.querySelector('#app-main')!, { top: 0, left: 0, width: 800, height: 400 })
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
    help: () => target.querySelector<HTMLElement>('[aria-label="Keyboard shortcuts"]'),
    tooltip: () => target.querySelector('.tooltip')?.textContent?.trim() ?? null,
    marks: () => target.querySelectorAll('.mark').length,
    startPicking() {
      event(control, 'pointerdown', { button: 0 })
      event(window, 'pointerup', { button: 0 })
    },
    hover(selector: string) {
      event(document.querySelector(selector)!, 'pointermove', { clientX: 20, clientY: 20 })
    },
    click(selector: string) {
      event(document.querySelector(selector)!, 'pointerdown', {
        button: 0,
        clientX: 20,
        clientY: 20,
      })
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

describe('the shortcut list', () => {
  it('opens with ? and closes with Escape without leaving picking', () => {
    const view = mountOverlay()
    try {
      view.startPicking()

      event(window, 'keydown', { key: '?' })
      expect(view.help()).not.toBeNull()

      // Every shortcut in the table is rendered, keys and all.
      const text = view.help()?.textContent ?? ''
      for (const shortcut of SHORTCUTS) {
        expect(text, shortcut.action).toContain(shortcut.action)
      }

      event(window, 'keydown', { key: 'Escape' })
      expect(view.help()).toBeNull()
      expect(view.control.getAttribute('aria-pressed')).toBe('true')

      event(window, 'keydown', { key: 'Escape' })
      expect(view.control.getAttribute('aria-pressed')).toBe('false')
    } finally {
      view.destroy()
    }
  })

  it('opens from the panel header button', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.click('#inner')
      const button = view.target.querySelector<HTMLButtonElement>(
        '[aria-label="Keyboard shortcuts"]',
      )!

      event(button, 'click', { detail: 1 })
      expect(view.help()).not.toBeNull()
    } finally {
      view.destroy()
    }
  })
})

describe('pinning the outline', () => {
  it('keeps the outlined element so a click confirms it, wherever the pointer goes', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.hover('#inner')

      event(window, 'keydown', { key: 'p' })
      view.hover('#side')
      expect(view.tooltip()).toMatch(/^button/)

      view.click('#side')
      expect(view.target.querySelector('.pick .name')?.textContent).toBe('button#inner')
    } finally {
      view.destroy()
    }
  })
})

describe('shift+enter', () => {
  it('picks the outlined element and leaves picking', () => {
    const view = mountOverlay()
    try {
      view.startPicking()
      view.hover('#inner')

      event(window, 'keydown', { key: 'Enter', shiftKey: true })

      expect(view.marks()).toBe(1)
      expect(view.control.getAttribute('aria-pressed')).toBe('false')

      // Escape still closes the panel that the pick opened, now that picking is over.
      expect(
        view.target.querySelector('[role="dialog"][aria-label="Build a prompt"]'),
      ).not.toBeNull()
      event(window, 'keydown', { key: 'Escape' })
      expect(view.target.querySelector('[role="dialog"][aria-label="Build a prompt"]')).toBeNull()
    } finally {
      view.destroy()
    }
  })
})

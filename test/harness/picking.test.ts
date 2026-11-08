import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPicking } from '../../src/overlay/picking.js'

let app: HTMLElement
let host: HTMLElement
let inside: HTMLElement
let stop: (() => void) | null = null
const picks: Element[] = []
const hovers: Array<Element | null> = []
let leaves = 0

function pointer(target: EventTarget, type: string, init: MouseEventInit = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  app = document.createElement('div')
  app.innerHTML = '<a id="link" href="/next"><span id="inner">go</span></a><p id="text">hello</p>'
  document.body.append(app)

  host = document.createElement('div')
  host.id = 'fake-host'
  inside = document.createElement('button')
  inside.textContent = 'panel button'
  host.append(inside)
  document.body.append(host)

  picks.length = 0
  hovers.length = 0
  leaves = 0

  stop = startPicking({
    host,
    onHover: (target) => hovers.push(target),
    onPick: (target) => picks.push(target),
    onLeave: () => (leaves += 1),
  })
})

afterEach(() => {
  stop?.()
  stop = null
  app.remove()
  host.remove()
})

describe('the event matrix', () => {
  it('picks on pointerdown and swallows the whole primary chain', () => {
    const link = document.getElementById('link')!

    const down = pointer(link, 'pointerdown', { button: 0 })
    expect(down.defaultPrevented).toBe(true)
    expect(picks).toEqual([link])

    for (const type of ['mousedown', 'mouseup', 'pointerup', 'click', 'dblclick']) {
      const event = pointer(link, type, { button: 0 })
      expect(event.defaultPrevented, type).toBe(true)
    }
  })

  it('picks the element under the pointer, not the text node inside it', () => {
    pointer(document.getElementById('inner')!, 'pointerdown', { button: 0 })
    expect(picks).toEqual([document.getElementById('inner')])
  })

  it('swallows the app click even though the pick happened on pointerdown', () => {
    const link = document.getElementById('link')!
    const appHandler = vi.fn()
    link.addEventListener('click', appHandler)

    pointer(link, 'pointerdown', { button: 0 })
    pointer(link, 'click', { button: 0 })

    expect(appHandler).not.toHaveBeenCalled()
  })

  it('lets the context menu through and does not pick on the right button', () => {
    const link = document.getElementById('link')!

    const down = pointer(link, 'pointerdown', { button: 2 })
    expect(down.defaultPrevented).toBe(false)
    expect(picks).toEqual([])

    const menu = pointer(link, 'contextmenu', { button: 2 })
    expect(menu.defaultPrevented).toBe(false)
  })

  it('lets secondary-button compatibility events through untouched', () => {
    const link = document.getElementById('link')!

    for (const type of ['mousedown', 'mouseup', 'pointerup', 'click']) {
      expect(pointer(link, type, { button: 1 }).defaultPrevented, type).toBe(false)
    }
  })

  it('leaves touch and drag events alone', () => {
    const link = document.getElementById('link')!
    for (const type of ['touchstart', 'touchend', 'dragstart', 'drop']) {
      expect(pointer(link, type).defaultPrevented, type).toBe(false)
    }
  })

  it('never swallows its own UI', () => {
    const event = pointer(inside, 'click', { button: 0 })

    expect(event.defaultPrevented).toBe(false)
    expect(picks).toEqual([])
  })

  it('reports the hovered element, including "nothing" over its own UI', () => {
    pointer(document.getElementById('text')!, 'pointermove', { clientX: 10, clientY: 20 })
    pointer(inside, 'pointermove', { clientX: 10, clientY: 20 })

    expect(hovers[0]).toBe(document.getElementById('text'))
    expect(hovers[1]).toBeNull()
  })

  it('removes every listener when it stops', () => {
    stop?.()
    stop = null

    const link = document.getElementById('link')!
    expect(pointer(link, 'pointerdown', { button: 0 }).defaultPrevented).toBe(false)
    expect(picks).toEqual([])
    expect(leaves).toBe(1)
  })
})

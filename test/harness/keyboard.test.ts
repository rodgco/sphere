import { afterEach, describe, expect, it } from 'vitest'
import { commandFor, initialTarget, isNavigable, navigate } from '../../src/overlay/keyboard.js'

function page(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

function key(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the key map', () => {
  it('walks the tree with w/a/s/d and the arrows', () => {
    expect(commandFor(key({ key: 'w' }))).toBe('parent')
    expect(commandFor(key({ key: 'ArrowUp' }))).toBe('parent')
    expect(commandFor(key({ key: 's' }))).toBe('firstChild')
    expect(commandFor(key({ key: 'ArrowDown' }))).toBe('firstChild')
    expect(commandFor(key({ key: 'a' }))).toBe('previousSibling')
    expect(commandFor(key({ key: 'ArrowLeft' }))).toBe('previousSibling')
    expect(commandFor(key({ key: 'd' }))).toBe('nextSibling')
    expect(commandFor(key({ key: 'ArrowRight' }))).toBe('nextSibling')
  })

  it('maps pick, undo and copy', () => {
    expect(commandFor(key({ key: 'Enter' }))).toBe('pick')
    expect(commandFor(key({ key: ' ' }))).toBe('pick')
    expect(commandFor(key({ key: 'Backspace' }))).toBe('unpickLast')
    expect(commandFor(key({ key: 'c' }))).toBe('copy')
    expect(commandFor(key({ key: 'Escape' }))).toBe('leave')
  })

  it('leaves everything else to the page', () => {
    for (const init of [
      { key: 'x' },
      { key: 'Tab' },
      { key: 'c', ctrlKey: true },
      { key: 'c', metaKey: true },
      { key: 'w', altKey: true },
      { key: 'C', shiftKey: true },
    ]) {
      expect(commandFor(key(init)), JSON.stringify(init)).toBeNull()
    }
  })
})

describe('navigate', () => {
  it('reaches a container that covers its children', () => {
    const root = page('<main><div class="fill"><button>inside</button></div></main>')
    const button = root.querySelector('button')!
    const fill = root.querySelector('.fill')!

    // Alt+click is not the point: the fill layer is what the pointer cannot select.
    expect(navigate(button, 'parent', root)).toBe(fill)
    expect(navigate(fill, 'parent', root)?.tagName).toBe('MAIN')
  })

  it('walks siblings, skipping elements that are never a selection', () => {
    const root = page('<div><span id="a"></span><br><script></script><span id="b"></span></div>')
    const a = root.querySelector('#a')!

    expect(navigate(a, 'nextSibling', root)?.id).toBe('b')
    expect(navigate(root.querySelector('#b')!, 'previousSibling', root)?.id).toBe('a')
  })

  it('descends into the first child, and stops where it must', () => {
    const root = page('<section><div><p id="deep"></p></div></section>')
    const section = root.querySelector('section')!

    expect(navigate(section, 'firstChild', root)?.tagName).toBe('DIV')
    expect(navigate(root.querySelector('#deep')!, 'firstChild', root)).toBeNull()
    expect(navigate(root.querySelector('#deep')!, 'nextSibling', root)).toBeNull()
  })

  it('never climbs to body or out of the app', () => {
    const root = page('<div><span></span></div>')
    const span = root.querySelector('span')!

    expect(navigate(span, 'parent', root)?.tagName).toBe('DIV')
    expect(navigate(root.querySelector('div')!, 'parent', root)).toBeNull()
  })

  it('treats the overlay host as untouchable', () => {
    const host = document.createElement('div')
    host.id = 'sphere-host'
    document.body.append(host)

    const app = document.createElement('div')
    document.body.append(app)

    expect(isNavigable(host)).toBe(false)
    expect(isNavigable(document.createElement('script'))).toBe(false)
    expect(isNavigable(app)).toBe(true)
    expect(isNavigable(document.createElement('div'))).toBe(false)
  })
})

describe('initialTarget', () => {
  it('starts from the last pick, then from the page content', () => {
    const root = page('<div id="one"></div><div id="two"></div>')
    const one = root.querySelector('#one')!
    const two = root.querySelector('#two')!

    expect(initialTarget([one, two], root)).toBe(two)
    expect(initialTarget([], root)).toBe(one)
  })

  it('has nowhere to go on an empty page', () => {
    const root = page('')
    expect(initialTarget([], root)).toBeNull()
  })
})

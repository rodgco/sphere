/**
 * Keyboard selection while picking (`docs/06-toolbar-ux.md` §2).
 *
 * The pointer picks the deepest element under it, which means a container that only wraps its
 * children — a fill layer, an overlay, a grid cell — can never be picked: its children are on top.
 * The Aardvark answer is to walk the tree with keys instead of the mouse.
 *
 * Everything here is pure and DOM-only: the overlay decides what to do with the answer, so the
 * navigation rules are testable without a browser.
 */

import { isOverlayElement } from './host.js'

export type NavCommand = 'parent' | 'firstChild' | 'previousSibling' | 'nextSibling'

export type PickKey = NavCommand | 'pick' | 'unpickLast' | 'copy' | 'leave'

/** Elements that are never a useful selection: document plumbing and non-rendered content. */
const NOT_NAVIGABLE = new Set([
  'HTML',
  'HEAD',
  'BODY',
  'SCRIPT',
  'STYLE',
  'LINK',
  'META',
  'TITLE',
  'NOSCRIPT',
  'TEMPLATE',
  'BR',
  'WBR',
])

const NAV_KEYS: Record<string, NavCommand> = {
  w: 'parent',
  arrowup: 'parent',
  s: 'firstChild',
  arrowdown: 'firstChild',
  a: 'previousSibling',
  arrowleft: 'previousSibling',
  d: 'nextSibling',
  arrowright: 'nextSibling',
}

/**
 * The key map. `null` means “not ours”: the event must reach the page, because picking only owns
 * what it acts on (`docs/specs/event-matrix.md`).
 */
export function commandFor(event: KeyboardEvent): PickKey | null {
  // Modifiers belong to the app and the browser (Cmd+W, Alt+Tab, Ctrl+C…).
  if (event.altKey || event.ctrlKey || event.metaKey) return null

  const key = event.key.toLowerCase()

  if (key === 'escape') return 'leave'
  if (key === 'backspace') return 'unpickLast'

  switch (key) {
    case 'enter':
    case ' ':
      return 'pick'
    case 'c':
      return event.shiftKey ? null : 'copy'
    default:
      return NAV_KEYS[key] ?? null
  }
}

/** Whether an element is a selection candidate at all. */
export function isNavigable(element: Element, root: Element = document.body): boolean {
  if (NOT_NAVIGABLE.has(element.tagName)) return false
  if (isOverlayElement(element)) return false
  if (element === root) return false
  return root.contains(element)
}

/**
 * One step from `element`. Returns `null` when the step is not possible, so the caller keeps the
 * current selection instead of jumping somewhere surprising.
 */
export function navigate(
  element: Element,
  command: NavCommand,
  root: Element = document.body,
): Element | null {
  switch (command) {
    case 'parent': {
      const parent = element.parentElement
      return parent !== null && isNavigable(parent, root) ? parent : null
    }
    case 'firstChild': {
      const child = element.firstElementChild
      return child !== null && isNavigable(child, root) ? child : null
    }
    case 'previousSibling': {
      const sibling = previousElement(element, root)
      return sibling
    }
    case 'nextSibling': {
      const sibling = nextElement(element, root)
      return sibling
    }
  }
}

/** Where a key press starts when nothing is selected yet: the last pick, else the page's content. */
export function initialTarget(
  picked: readonly Element[],
  root: Element = document.body,
): Element | null {
  const last = picked.at(-1)
  if (last !== undefined && isNavigable(last, root)) return last

  for (const child of root.children) {
    if (isNavigable(child, root)) return child
  }

  return null
}

function previousElement(element: Element, root: Element): Element | null {
  for (
    let sibling = element.previousElementSibling;
    sibling !== null;
    sibling = sibling.previousElementSibling
  ) {
    if (isNavigable(sibling, root)) return sibling
  }
  return null
}

function nextElement(element: Element, root: Element): Element | null {
  for (
    let sibling = element.nextElementSibling;
    sibling !== null;
    sibling = sibling.nextElementSibling
  ) {
    if (isNavigable(sibling, root)) return sibling
  }
  return null
}

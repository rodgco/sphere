/**
 * Marks: a picked element stays visible while the page moves under it.
 *
 * Geometry is pure (`measureMark`), tracking is a single set of listeners throttled to one frame.
 * The overlay draws the marks itself — the app's DOM is never styled (`docs/06-toolbar-ux.md` §7).
 */

import { clipRect, scrollContainers } from './position.js'

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Mark extends Rect {
  index: number
}

export interface MarkTarget {
  element: Element
  index: number
}

/** One frame at most: scroll and mutations both fire in bursts. */
export function throttleFrame(callback: () => void): () => void {
  let frame = 0

  return () => {
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      callback()
    })
  }
}

/** The mark for one element, clipped by the viewport and by every scrollable ancestor. */
export function measureMark(target: MarkTarget, doc: Document = document): Mark | null {
  const rect = target.element.getBoundingClientRect()
  if (!target.element.isConnected) return null

  const viewport: Rect = {
    top: 0,
    left: 0,
    width: doc.defaultView?.innerWidth ?? 0,
    height: doc.defaultView?.innerHeight ?? 0,
  }

  const clips: Rect[] = [viewport, ...scrollContainers(target.element, doc).map(rectOf)]

  return toMark(rect, clips, target.index)
}

export function measureMarks(targets: readonly MarkTarget[], doc: Document = document): Mark[] {
  const marks: Mark[] = []

  for (const target of targets) {
    const mark = measureMark(target, doc)
    if (mark !== null) marks.push(mark)
  }

  return marks
}

/**
 * Refreshes the marks on scroll (capturing, so scrollable ancestors count), resize, element resize
 * and DOM mutations. Returns the cleanup; callers re-create it when the picks change.
 */
export function trackMarks(targets: readonly MarkTarget[], refresh: () => void): () => void {
  const schedule = throttleFrame(refresh)

  window.addEventListener('scroll', schedule, true)
  window.addEventListener('resize', schedule)

  const resize = new ResizeObserver(schedule)
  for (const target of targets) resize.observe(target.element)

  const mutations = new MutationObserver(schedule)
  mutations.observe(document.documentElement, { childList: true, subtree: true, attributes: true })

  refresh()

  return () => {
    window.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule)
    resize.disconnect()
    mutations.disconnect()
  }
}

function rectOf(element: Element): Rect {
  return rectOfBox(element.getBoundingClientRect())
}

function rectOfBox(box: DOMRect): Rect {
  return { top: box.top, left: box.left, width: box.width, height: box.height }
}

function toMark(rect: DOMRect, clips: readonly Rect[], index: number): Mark | null {
  const clipped = clipRect(rectOfBox(rect), clips)
  return clipped === null ? null : { ...clipped, index }
}

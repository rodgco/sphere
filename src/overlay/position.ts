/**
 * Geometry the overlay needs, kept pure so it can be tested without a browser layout:
 * clamping the control into the viewport and deciding where the panel fits.
 */

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Keeps the control fully visible after a drag or a window resize. */
export function clampControl(position: Point, control: Size, viewport: Size): Point {
  return {
    x: clamp(position.x, 0, Math.max(0, viewport.width - control.width)),
    y: clamp(position.y, 0, Math.max(0, viewport.height - control.height)),
  }
}

export type PanelSide = 'above' | 'below'

export interface PanelPlacement {
  side: PanelSide
  /** Horizontal alignment against the control. */
  align: 'left' | 'right'
  top: number
  left: number
  maxHeight: number
}

export const PANEL_GAP = 10
export const VIEWPORT_MARGIN = 18

/**
 * Docs/06 §4: the panel opens on whichever side of the control has room, aligned to the control's
 * own side, and its height is clamped so it never leaves the viewport.
 */
export function panelPlacement(control: Point & Size, panel: Size, viewport: Size): PanelPlacement {
  const belowTop = control.y + control.height + PANEL_GAP
  const spaceBelow = viewport.height - belowTop - VIEWPORT_MARGIN
  const spaceAbove = control.y - PANEL_GAP - VIEWPORT_MARGIN
  const side: PanelSide = spaceAbove >= spaceBelow ? 'above' : 'below'

  const align: 'left' | 'right' =
    control.x + control.width / 2 <= viewport.width / 2 ? 'left' : 'right'

  const left = clamp(
    align === 'left' ? control.x : control.x + control.width - panel.width,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, viewport.width - panel.width - VIEWPORT_MARGIN),
  )

  const available = Math.max(0, side === 'above' ? spaceAbove : spaceBelow)
  const maxHeight = Math.max(0, Math.min(available, panel.height))

  return {
    side,
    align,
    left,
    top: side === 'above' ? control.y - PANEL_GAP - maxHeight : belowTop,
    maxHeight,
  }
}

/**
 * A mark is clipped by every scrollable ancestor, not only the viewport (docs/06 §3): the element
 * may be visible while the pane it scrolls in is not.
 */
export function clipRect(
  rect: { top: number; left: number; width: number; height: number },
  clips: readonly { top: number; left: number; width: number; height: number }[],
): { top: number; left: number; width: number; height: number } | null {
  let { top, left, width, height } = rect

  for (const clip of clips) {
    const right = Math.min(left + width, clip.left + clip.width)
    const bottom = Math.min(top + height, clip.top + clip.height)
    left = Math.max(left, clip.left)
    top = Math.max(top, clip.top)
    width = right - left
    height = bottom - top
  }

  if (width <= 0 || height <= 0) return null
  return { top, left, width, height }
}

/** The scrollable ancestors of an element, outermost last, plus the viewport as the first clip. */
export function scrollContainers(element: Element, doc: Document): Element[] {
  const containers: Element[] = []
  const viewport = doc.scrollingElement ?? doc.documentElement

  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    if (
      /(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)
    ) {
      containers.push(parent)
    }
    if (parent === viewport) break
  }

  return containers
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

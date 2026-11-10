/**
 * Geometry the overlay needs, kept pure so it can be tested without a browser layout:
 * clamping the control into the viewport, deciding where the panel sits, and drawing the marks.
 */

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** The distance the overlay keeps from every viewport edge: the control's corner and the panel's
 * margin. `styles.ts` interpolates the same constant, so the CSS cannot drift from the geometry. */
export const EDGE = 18

/** The visible gap between the control and the panel, in every side and alignment. */
export const PANEL_GAP = 10

export const PANEL_WIDTH = 420
export const PANEL_MAX_HEIGHT = 620
/** The panel never takes more than this share of the viewport height (`docs/06-toolbar-ux.md` §4). */
export const PANEL_MAX_VIEWPORT_RATIO = 0.7

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
  left: number
  width: number
  /**
   * The viewport edge the panel is pinned to, and its distance from that edge: `bottom` when the
   * panel is above the control, `top` when it is below. Pinning the facing edge — instead of
   * computing a `top` from an assumed height — is what keeps a short panel exactly `PANEL_GAP`
   * away from the control, and what makes the panel travel with it while it is dragged.
   */
  offset: number
  maxHeight: number
}

/**
 * Docs/06 §4: the panel sits on whichever side of the control has room — that is the side the
 * control is *away* from, so dragging the pill towards the bottom moves the panel above it — and
 * is aligned to the control's own side, clamped by `EDGE` so it never leaves the viewport.
 */
export function panelPlacement(control: Point & Size, viewport: Size): PanelPlacement {
  const belowTop = control.y + control.height + PANEL_GAP
  const spaceBelow = viewport.height - belowTop - EDGE
  const spaceAbove = control.y - PANEL_GAP - EDGE
  const side: PanelSide = spaceAbove >= spaceBelow ? 'above' : 'below'

  const width = clamp(PANEL_WIDTH, 0, Math.max(0, viewport.width - 2 * EDGE))

  const align: 'left' | 'right' =
    control.x + control.width / 2 <= viewport.width / 2 ? 'left' : 'right'

  const left = clamp(
    align === 'left' ? control.x : control.x + control.width - width,
    EDGE,
    Math.max(EDGE, viewport.width - width - EDGE),
  )

  const available = Math.max(0, side === 'above' ? spaceAbove : spaceBelow)
  const maxHeight = Math.min(
    available,
    PANEL_MAX_HEIGHT,
    viewport.height * PANEL_MAX_VIEWPORT_RATIO,
  )

  return {
    side,
    align,
    left,
    width,
    offset: side === 'above' ? viewport.height - control.y + PANEL_GAP : belowTop,
    maxHeight: Math.max(0, maxHeight),
  }
}

/** The panel's inline style. Both vertical edges are always set, so a side flip cannot leave one. */
export function panelStyle(placement: PanelPlacement): string {
  const vertical =
    placement.side === 'above'
      ? `bottom: ${placement.offset}px; top: auto;`
      : `top: ${placement.offset}px; bottom: auto;`

  return `left: ${placement.left}px; ${vertical} width: ${placement.width}px; max-height: ${placement.maxHeight}px;`
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

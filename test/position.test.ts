import { describe, expect, it } from 'vitest'
import {
  EDGE,
  PANEL_GAP,
  PANEL_MAX_HEIGHT,
  clampControl,
  clipRect,
  panelPlacement,
  panelStyle,
} from '../src/overlay/position.js'

const viewport = { width: 1000, height: 800 }
const control = { x: 900, y: 700, width: 120, height: 36 }

describe('clampControl', () => {
  it('leaves a position inside the viewport alone', () => {
    expect(clampControl({ x: 100, y: 200 }, { width: 120, height: 36 }, viewport)).toEqual({
      x: 100,
      y: 200,
    })
  })

  it('pulls the control back inside, never past the origin', () => {
    expect(clampControl({ x: 980, y: 790 }, { width: 120, height: 36 }, viewport)).toEqual({
      x: 880,
      y: 764,
    })
    expect(clampControl({ x: -50, y: -10 }, { width: 120, height: 36 }, viewport)).toEqual({
      x: 0,
      y: 0,
    })
  })

  it('never goes negative when the viewport is smaller than the control', () => {
    expect(
      clampControl({ x: 10, y: 10 }, { width: 400, height: 400 }, { width: 300, height: 300 }),
    ).toEqual({ x: 0, y: 0 })
  })
})

describe('panelPlacement', () => {
  it('opens above when the control is in the lower half', () => {
    const placement = panelPlacement(control, viewport)
    expect(placement.side).toBe('above')
    // Pinned by its bottom edge, PANEL_GAP above the control, whatever the panel's height is.
    expect(placement.offset).toBe(viewport.height - control.y + PANEL_GAP)
    expect(placement.maxHeight).toBeLessThanOrEqual(control.y - PANEL_GAP - EDGE)
  })

  it('opens below when the control is in the upper half', () => {
    const placement = panelPlacement({ x: 40, y: 40, width: 120, height: 36 }, viewport)
    expect(placement.side).toBe('below')
    expect(placement.offset).toBe(40 + 36 + PANEL_GAP)
    expect(placement.align).toBe('left')
    // Aligned to the control's own side, only pulled in by the viewport margin.
    expect(placement.left).toBe(40)
  })

  it('flips sides when the control is dragged across the middle', () => {
    expect(panelPlacement(control, viewport).side).toBe('above')
    expect(panelPlacement({ ...control, y: 40 }, viewport).side).toBe('below')
  })

  it('aligns to the control side and never leaves the viewport', () => {
    const right = panelPlacement(control, viewport)
    expect(right.align).toBe('right')
    expect(right.width).toBe(420)
    expect(right.left).toBe(1000 - 420 - 18)
  })

  it('narrows the panel to the viewport and keeps the margin', () => {
    const narrow = panelPlacement(
      { x: 0, y: 40, width: 10, height: 10 },
      {
        width: 300,
        height: 800,
      },
    )
    expect(narrow.width).toBe(300 - 2 * EDGE)
    expect(narrow.left).toBe(EDGE)
  })

  it('clamps the height to the room available, never to a negative number', () => {
    const tiny = panelPlacement(
      { x: 0, y: 0, width: 10, height: 10 },
      {
        width: 100,
        height: 20,
      },
    )
    expect(tiny.side).toBe('below')
    expect(tiny.maxHeight).toBe(0)
  })

  it('never exceeds the panel cap, however much room there is', () => {
    const tall = panelPlacement(
      { x: 500, y: 3800, width: 120, height: 36 },
      {
        width: 1000,
        height: 4000,
      },
    )
    expect(tall.side).toBe('above')
    expect(tall.maxHeight).toBe(PANEL_MAX_HEIGHT)
  })
})

describe('panelStyle', () => {
  it('pins the edge facing the control and clears the other one', () => {
    const above = panelPlacement(control, viewport)
    expect(panelStyle(above)).toContain(`bottom: ${above.offset}px; top: auto;`)

    const below = panelPlacement({ ...control, y: 40 }, viewport)
    expect(panelStyle(below)).toContain(`top: ${below.offset}px; bottom: auto;`)
  })

  it('carries the width, the left clamp and the height cap', () => {
    const placement = panelPlacement(control, viewport)
    const css = panelStyle(placement)
    expect(css).toContain(`left: ${placement.left}px`)
    expect(css).toContain(`width: ${placement.width}px`)
    expect(css).toContain(`max-height: ${placement.maxHeight}px`)
  })
})

describe('clipRect', () => {
  it('returns the rectangle when no ancestor clips it', () => {
    expect(clipRect({ top: 10, left: 10, width: 20, height: 20 }, [])).toEqual({
      top: 10,
      left: 10,
      width: 20,
      height: 20,
    })
  })

  it('intersects with every scrollable ancestor', () => {
    const clipped = clipRect({ top: 0, left: 0, width: 100, height: 100 }, [
      { top: 0, left: 0, width: 50, height: 100 },
      { top: 25, left: 0, width: 50, height: 40 },
    ])

    expect(clipped).toEqual({ top: 25, left: 0, width: 50, height: 40 })
  })

  it('hides the mark entirely when the ancestor does not overlap', () => {
    expect(
      clipRect({ top: 0, left: 0, width: 10, height: 10 }, [
        { top: 50, left: 0, width: 10, height: 10 },
      ]),
    ).toBeNull()
  })
})

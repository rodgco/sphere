import { describe, expect, it } from 'vitest'
import { clampControl, clipRect, panelPlacement } from '../src/overlay/position.js'

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
  const panel = { width: 420, height: 320 }

  it('opens above when the control is in the lower half', () => {
    const placement = panelPlacement(control, panel, viewport)
    expect(placement.side).toBe('above')
    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(control.y)
    expect(placement.maxHeight).toBe(Math.min(320, 700 - 10 - 18))
  })

  it('opens below when the control is in the upper half', () => {
    const placement = panelPlacement({ x: 40, y: 40, width: 120, height: 36 }, panel, viewport)
    expect(placement.side).toBe('below')
    expect(placement.top).toBe(40 + 36 + 10)
    expect(placement.align).toBe('left')
    // Aligned to the control's own side, only pulled in by the viewport margin.
    expect(placement.left).toBe(40)
  })

  it('aligns to the control side and never leaves the viewport', () => {
    const right = panelPlacement(control, panel, viewport)
    expect(right.align).toBe('right')
    expect(right.left).toBe(1000 - 420 - 18)
  })

  it('clamps the height to the room available, never to a negative number', () => {
    const tiny = panelPlacement({ x: 0, y: 0, width: 10, height: 10 }, panel, {
      width: 100,
      height: 20,
    })
    expect(tiny.maxHeight).toBeGreaterThanOrEqual(0)
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

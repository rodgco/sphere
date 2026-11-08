import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureMark, measureMarks } from '../../src/overlay/marks.js'

function rect(element: Element, box: Partial<DOMRect>) {
  element.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...box,
    }) as DOMRect
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('measureMark', () => {
  it('reports the element rectangle in viewport coordinates', () => {
    const element = document.createElement('div')
    document.body.append(element)
    rect(element, { top: 20, left: 30, width: 100, height: 40 })

    expect(measureMark({ element, index: 0 })).toEqual({
      top: 20,
      left: 30,
      width: 100,
      height: 40,
      index: 0,
    })

    element.remove()
  })

  it('clips to the viewport', () => {
    const element = document.createElement('div')
    document.body.append(element)
    rect(element, { top: -50, left: -10, width: 100, height: 100 })

    const mark = measureMark({ element, index: 1 })
    expect(mark).toMatchObject({ top: 0, left: 0, width: 90, height: 50, index: 1 })

    element.remove()
  })

  it('clips by every scrollable ancestor and hides when nothing remains', () => {
    const pane = document.createElement('div')
    const element = document.createElement('div')
    pane.append(element)
    document.body.append(pane)

    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (candidate: Element) =>
        ({
          overflow: candidate === pane ? 'auto' : 'visible',
          overflowX: candidate === pane ? 'auto' : 'visible',
          overflowY: candidate === pane ? 'auto' : 'visible',
        }) as CSSStyleDeclaration,
    )
    rect(pane, { top: 100, left: 0, width: 200, height: 100 })
    rect(element, { top: 0, left: 0, width: 50, height: 50 })

    // The element sits above the visible part of its scroll container.
    expect(measureMark({ element, index: 0 })).toBeNull()

    rect(element, { top: 120, left: 10, width: 50, height: 50 })
    expect(measureMark({ element, index: 0 })).toMatchObject({ top: 120, height: 50 })

    pane.remove()
  })

  it('skips elements that left the document', () => {
    const element = document.createElement('div')
    rect(element, { top: 0, left: 0, width: 10, height: 10 })

    expect(measureMark({ element, index: 0 })).toBeNull()
    expect(measureMarks([{ element, index: 0 }])).toEqual([])
  })
})

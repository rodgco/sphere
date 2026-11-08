import { afterEach, describe, expect, it } from 'vitest'
import { lockCursor } from '../../src/overlay/cursor.js'

afterEach(() => {
  for (const style of document.querySelectorAll('style#sphere-picking-cursor')) style.remove()
})

describe('lockCursor', () => {
  it('overrides the cursor of every element, including the ones that set their own', () => {
    const link = document.createElement('a')
    link.href = '/next'
    link.textContent = 'link'
    document.body.append(link)

    lockCursor()

    const rule = document.getElementById('sphere-picking-cursor')?.textContent ?? ''
    expect(rule).toMatch(/body \*/)
    expect(rule).toContain('crosshair !important')

    // The stylesheet is what wins; the app's own `cursor: pointer` on links stays untouched.
    expect(getComputedStyle(link).cursor).toBe('crosshair')

    link.remove()
  })

  it('removes exactly its own stylesheet, leaving the page as it was', () => {
    const app = document.createElement('style')
    app.textContent = 'body { cursor: default; }'
    document.head.append(app)

    const restore = lockCursor()
    expect(document.querySelectorAll('style#sphere-picking-cursor')).toHaveLength(1)

    restore()

    expect(document.querySelectorAll('style#sphere-picking-cursor')).toHaveLength(0)
    expect(document.head.contains(app)).toBe(true)
    expect(document.documentElement.style.cursor).toBe('')

    app.remove()
  })

  it('does not touch the app inline styles', () => {
    document.documentElement.style.cursor = 'wait'
    const restore = lockCursor()

    restore()

    expect(document.documentElement.style.cursor).toBe('wait')
    document.documentElement.style.cursor = ''
  })
})

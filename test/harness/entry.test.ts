import { describe, expect, it } from 'vitest'
import { HOST_ID, mountOverlay } from '../../src/overlay/entry.js'

describe('the overlay entry', () => {
  it('mounts one host with a shadow root, styles and the control', () => {
    const host = document.getElementById(HOST_ID)

    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(document.documentElement)

    const shadow = host?.shadowRoot
    expect(shadow).not.toBeNull()
    expect(shadow?.querySelector('style')?.textContent).toContain(':host')
    expect(shadow?.querySelector('button.control')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('does not mount twice (HMR, double import)', () => {
    expect(mountOverlay()).toBeNull()
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
  })
})

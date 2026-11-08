import { describe, expect, it } from 'vitest'
import Child from '../../fixtures/harness/Child.svelte'
import Each from '../../fixtures/harness/Each.svelte'
import MultiRoot from '../../fixtures/harness/MultiRoot.svelte'
import Single from '../../fixtures/harness/Single.svelte'
import { metaOf, render } from './lib.js'

/**
 * `dev: true` compilation makes Svelte attach `__svelte_meta.loc` to the nodes it located
 * (`add_locations`, svelte/src/internal/client/dev/elements.js). That metadata is the only
 * source of truth for element → source location, so the harness has to be able to see it.
 * See docs/04-element-inspection.md.
 */
describe('element metadata from the Svelte compiler', () => {
  it('is present on a single-root element', () => {
    const view = render(Single)
    try {
      const loc = metaOf(view.byTestId('single'))?.loc
      expect(loc?.file).toMatch(/fixtures\/harness\/Single\.svelte$/)
      expect(loc?.line).toBe(1)
    } finally {
      view.destroy()
    }
  })

  it('is attached to every root, including the ones around a child component', () => {
    const view = render(MultiRoot)
    try {
      const first = metaOf(view.byTestId('first'))?.loc
      const child = metaOf(view.byTestId('child'))?.loc
      const last = metaOf(view.byTestId('last'))?.loc

      expect(first?.file).toMatch(/MultiRoot\.svelte$/)
      expect(child?.file).toMatch(/Child\.svelte$/)
      expect(last?.file).toMatch(/MultiRoot\.svelte$/)

      // Positional assignment: three roots, three locations, in source order.
      expect(first!.line).toBeLessThan(last!.line)
    } finally {
      view.destroy()
    }
  })

  it('is attached to every iteration of an {#each}', () => {
    const view = render(Each)
    try {
      const lines = ['item-0', 'item-1', 'item-2'].map((id) => metaOf(view.byTestId(id))?.loc?.line)
      expect(lines.every((line) => typeof line === 'number')).toBe(true)
      expect(lines[0]).toBe(lines[1])
    } finally {
      view.destroy()
    }
  })

  it('carries a component parent stack, which the stamping will use', () => {
    const view = render(Child, { label: 'stacked' })
    try {
      expect(metaOf(view.byTestId('child'))).toHaveProperty('parent')
    } finally {
      view.destroy()
    }
  })
})

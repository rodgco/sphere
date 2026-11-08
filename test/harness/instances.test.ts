import { describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import { frameOf, getInstance, instanceOf } from '../../src/runtime/instrumentation.js'
import BigState from '../../fixtures/harness/BigState.svelte'
import Conditional from '../../fixtures/harness/Conditional.svelte'
import Each from '../../fixtures/harness/Each.svelte'
import Late from '../../fixtures/harness/Late.svelte'
import MultiRoot from '../../fixtures/harness/MultiRoot.svelte'
import Props from '../../fixtures/harness/Props.svelte'
import Single from '../../fixtures/harness/Single.svelte'
import { render } from './lib.js'

/**
 * What the wrappers have to deliver: from a DOM element, the instance that rendered it, the
 * chain above it, where its tag sits in the parent, its live props, and the named signals of
 * its `$state`/`$derived`. Everything here is what `inspectElement` (M1 step 4) will read.
 */
describe('instances', () => {
  it('attributes an element to the component that rendered it', () => {
    const view = render(Single)
    try {
      const instance = instanceOf(view.byTestId('single'))
      expect(instance?.name).toBe('Single')
      expect(instance?.file).toMatch(/fixtures\/harness\/Single\.svelte$/)
      expect(instance?.parent).toBeNull()
      expect(instance?.usage).toBeNull()
      expect(getInstance(instance!.id)).toBe(instance)
    } finally {
      view.destroy()
    }
  })

  it('keeps the chain and the usage frame of a child component', () => {
    const view = render(MultiRoot)
    try {
      const root = instanceOf(view.byTestId('first'))
      const child = instanceOf(view.byTestId('child'))

      expect(root?.name).toBe('MultiRoot')
      expect(child?.name).toBe('Child')
      expect(child?.parent).toBe(root)

      // The frame where `<Child />` is used in the parent: file, line and tag name.
      expect(child?.usage).toMatchObject({ type: 'component', componentTag: 'Child', line: 6 })
      expect(child?.usage?.file).toMatch(/MultiRoot\.svelte$/)
      expect(child?.usage?.instance).toBe(root)

      expect(instanceOf(view.byTestId('last'))).toBe(root)
    } finally {
      view.destroy()
    }
  })

  it('attributes elements created inside a block, including after init', () => {
    const conditional = render(Conditional)
    const late = render(Late)
    try {
      expect(instanceOf(conditional.byTestId('yes'))?.name).toBe('Conditional')
      expect(frameOf(conditional.byTestId('yes'))?.type).toBe('if')

      // `Late` renders its branch from an effect, after the component's init returned.
      flushSync()
      expect(instanceOf(late.byTestId('late'))?.name).toBe('Late')
    } finally {
      conditional.destroy()
      late.destroy()
    }
  })

  it('attributes every iteration of an {#each}', () => {
    const view = render(Each)
    try {
      for (const id of ['item-0', 'item-1', 'item-2']) {
        expect(instanceOf(view.byTestId(id))?.name).toBe('Each')
      }
      expect(frameOf(view.byTestId('item-0'))?.type).toBe('each')
    } finally {
      view.destroy()
    }
  })

  it('reports props as the live object Svelte keeps', () => {
    const view = render(Props, { name: 'Prompt', count: 21 })
    try {
      const instance = instanceOf(view.byTestId('props'))
      expect(instance?.props).toMatchObject({ name: 'Prompt', count: 21 })
    } finally {
      view.destroy()
    }
  })

  it('collects named $derived values', () => {
    const view = render(Props, { name: 'Prompt', count: 21 })
    try {
      const instance = instanceOf(view.byTestId('props'))!
      const doubled = instance.state.get('doubled')
      const label = instance.state.get('label')

      expect(doubled?.kind).toBe('signal')
      expect((doubled!.source as { v: unknown }).v).toBe(42)
      expect((label!.source as { v: unknown }).v).toBe('Prompt: 42')
    } finally {
      view.destroy()
    }
  })

  it('collects proxy state by value and derived state by signal', () => {
    const view = render(BigState)
    try {
      const instance = instanceOf(view.byTestId('big'))!
      const all = instance.state.get('all')
      const shown = instance.state.get('shown')

      expect(all?.kind).toBe('value')
      expect((all!.source as unknown[]).length).toBe(500)
      expect((shown!.source as { v: unknown[] }).v).toHaveLength(500)
      // Order is creation order, so a prompt reads the component top-to-bottom.
      expect([...instance.state.keys()]).toEqual(['all', 'shown'])
    } finally {
      view.destroy()
    }
  })
})

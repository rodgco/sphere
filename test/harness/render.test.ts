import { describe, expect, it } from 'vitest'
import * as client from 'svelte/internal/client'
import { isInstrumentationInstalled } from '../../src/runtime/instrumentation.js'
import BigState from '../../fixtures/harness/BigState.svelte'
import Child from '../../fixtures/harness/Child.svelte'
import Conditional from '../../fixtures/harness/Conditional.svelte'
import Each from '../../fixtures/harness/Each.svelte'
import MultiRoot from '../../fixtures/harness/MultiRoot.svelte'
import Props from '../../fixtures/harness/Props.svelte'
import Single from '../../fixtures/harness/Single.svelte'
import Snippet from '../../fixtures/harness/Snippet.svelte'
import { render } from './lib.js'

/**
 * Baseline for the harness itself: every fixture compiles for the client, mounts in a
 * DOM, and reaches the app through the *wrapped* client module. If one of these fails,
 * nothing the later layers assert about props/state can be trusted.
 */
describe('fixtures render through the wrapped client module', () => {
  it('uses the generated wrapper as the client module', () => {
    expect(Object.keys(client).length).toBeGreaterThan(100)
    expect(isInstrumentationInstalled()).toBe(true)
  })

  it('renders a single-root component', () => {
    const view = render(Single)
    try {
      expect(view.byTestId('single').tagName).toBe('SECTION')
      expect(view.text()).toContain('One element at the root.')
    } finally {
      view.destroy()
    }
  })

  it('renders multiple roots with a child component between them', () => {
    const view = render(MultiRoot)
    try {
      expect(view.byTestId('first').textContent).toBe('first')
      expect(view.byTestId('child').textContent).toBe('in between')
      expect(view.byTestId('last').textContent).toBe('last')
      expect(view.target.children).toHaveLength(3)
    } finally {
      view.destroy()
    }
  })

  it('renders both branches of an {#if}', () => {
    const open = render(Conditional)
    const closed = render(Conditional, { open: false })
    try {
      expect(open.byTestId('yes').textContent).toBe('conditional')
      expect(closed.byTestId('no').textContent).toBe('hidden')
    } finally {
      open.destroy()
      closed.destroy()
    }
  })

  it('renders an {#each} block', () => {
    const view = render(Each)
    try {
      expect(view.target.querySelectorAll('li')).toHaveLength(3)
      expect(view.byTestId('item-1').textContent).toBe('beta')
    } finally {
      view.destroy()
    }
  })

  it('renders a snippet inside a host component', () => {
    const view = render(Snippet)
    try {
      expect(view.byTestId('host').contains(view.byTestId('snippeted'))).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('renders props and derived state', () => {
    const view = render(Props, { name: 'Prompt', count: 21 })
    try {
      expect(view.byTestId('props').textContent).toBe('Prompt: 42')
    } finally {
      view.destroy()
    }
  })

  it('renders a component with large state', () => {
    const view = render(BigState, { size: 500 })
    try {
      expect(view.byTestId('big').textContent).toBe('500 items')
    } finally {
      view.destroy()
    }
  })

  it('renders a child component on its own', () => {
    const view = render(Child, { label: 'solo' })
    try {
      expect(view.byTestId('child').textContent).toBe('solo')
    } finally {
      view.destroy()
    }
  })
})

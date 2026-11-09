import { describe, expect, it } from 'vitest'
import { inspectElement, locateElement } from '../../src/runtime/inspect.js'
import BigState from '../../fixtures/harness/BigState.svelte'
import Child from '../../fixtures/harness/Child.svelte'
import Each from '../../fixtures/harness/Each.svelte'
import MultiRoot from '../../fixtures/harness/MultiRoot.svelte'
import Props from '../../fixtures/harness/Props.svelte'
import Single from '../../fixtures/harness/Single.svelte'
import Styled from '../../fixtures/harness/Styled.svelte'
import { render } from './lib.js'

const inspect = (node: Node | null) => inspectElement(node)
const locate = (node: Node | null) => locateElement(node)

const jsonOf = (text: string | null) => (text === null ? null : JSON.parse(text))

describe('inspection API', () => {
  it('exposes both entry points without a page global', () => {
    expect(typeof inspectElement).toBe('function')
    expect(typeof locateElement).toBe('function')
    expect('__SPHERE__' in window).toBe(false)
  })
})

describe('inspectElement', () => {
  it('describes the element without its rendered text', () => {
    const view = render(Single)
    try {
      const inspected = inspect(view.byTestId('single'))

      expect(inspected.error).toBeUndefined()
      expect(inspected.element).toMatchObject({
        tag: 'section',
        tagName: 'SECTION',
        id: '',
        classes: ['single'],
      })
      // The harness mounts into a bare div, so the selector has one segment above the fixture.
      expect(inspected.element?.selector).toMatch(/(^| > )section\.single$/)
      expect(inspected.element?.attrs['data-testid']).toBe('single')
      expect(inspected.element?.markup).toBe(
        '<section class="single" data-testid="single"><h2></h2><p></p></section>',
      )
      expect(inspected.element?.markup).not.toContain('One element at the root.')
      expect(inspected.element?.size).toMatch(/^\d+×\d+$/)
    } finally {
      view.destroy()
    }
  })

  it("reports Svelte's location pessimistically until it can be verified", () => {
    const view = render(Single)
    try {
      const { source } = inspect(view.byTestId('single'))

      expect(source).toMatchObject({ line: 1, column: 0, enclosing: true })
      expect(source?.file).toMatch(/fixtures\/harness\/Single\.svelte$/)
    } finally {
      view.destroy()
    }
  })

  it('carries the template context and the instance chain of a child component', () => {
    const view = render(MultiRoot)
    try {
      const inspected = inspect(view.byTestId('child'))

      expect(inspected.source?.file).toMatch(/Child\.svelte$/)
      expect(inspected.template).toEqual([
        {
          type: 'component',
          file: expect.stringMatching(/MultiRoot\.svelte$/),
          line: 6,
          column: 0,
          componentTag: 'Child',
        },
      ])

      expect(inspected.components.map((component) => component.name)).toEqual([
        'Child',
        'MultiRoot',
      ])
      expect(inspected.components[0]?.usage).toMatchObject({ line: 6, componentTag: 'Child' })
      expect(inspected.components[1]?.usage).toBeNull()
      expect(inspected.components[0]?.props).toBe('{"label":"in between"}')
    } finally {
      view.destroy()
    }
  })

  it('keeps props and state as parseable JSON', () => {
    const view = render(Props, { name: 'Prompt', count: 21 })
    try {
      const [component] = inspect(view.byTestId('props')).components

      expect(jsonOf(component?.props ?? null)).toEqual({ name: 'Prompt', count: 21 })
      // Only named signals are reported; props are not state and a plain `$state` that is
      // never reassigned is compiled away (docs/learning/svelte-internals.md §5).
      expect(component?.state).toEqual([
        { name: 'doubled', type: 'derived', value: '42' },
        { name: 'label', type: 'derived', value: '"Prompt: 42"' },
      ])
    } finally {
      view.destroy()
    }
  })

  it('applies the value budgets and says what was left out', () => {
    const view = render(BigState)
    try {
      const [component] = inspect(view.byTestId('big')).components
      const state = Object.fromEntries((component?.state ?? []).map((node) => [node.name, node]))

      const all = jsonOf(state.all?.value ?? 'null') as unknown[]
      const shown = jsonOf(state.shown?.value ?? 'null') as unknown[]

      expect(state.all?.type).toBe('state')
      expect(all).toHaveLength(26)
      expect(all.at(-1)).toBe('… 475 more')
      expect(shown).toHaveLength(26)
    } finally {
      view.destroy()
    }
  })

  it('attributes an element inside a block and lists the block frame', () => {
    const view = render(Each, { items: ['alpha', 'beta', 'gamma'] })
    try {
      const inspected = inspect(view.byTestId('item-1'))

      expect(inspected.element?.tag).toBe('li')
      expect(inspected.template[0]).toMatchObject({ type: 'each', line: 6 })
      expect(inspected.components[0]?.name).toBe('Each')
      expect(jsonOf(inspected.components[0]?.props ?? null)).toMatchObject({
        items: ['alpha', 'beta', 'gamma'],
      })
    } finally {
      view.destroy()
    }
  })

  it("drops Svelte's scoping classes from identity but keeps them where they are", () => {
    const view = render(Styled)
    try {
      const inspected = inspect(view.byTestId('styled'))

      expect(view.byTestId('styled').className).toMatch(/svelte-/)
      expect(inspected.element?.classes).toEqual(['styled'])
      expect(inspected.element?.markup).not.toContain('svelte-')
      expect(inspected.element?.selector).toMatch(/(^| > )p\.styled$/)
    } finally {
      view.destroy()
    }
  })

  it('never throws and degrades honestly', () => {
    const detached = document.createElement('div')
    detached.id = 'detached'

    const nothing = inspect(null)
    const outside = inspect(detached)
    const body = inspect(document.body)

    expect(nothing.error).toBeUndefined()
    expect(nothing).toMatchObject({ element: null, source: null, template: [], components: [] })

    expect(outside.element?.id).toBe('detached')
    expect(outside.source).toBeNull()
    expect(outside.components).toEqual([])

    expect(body.element?.tag).toBe('body')
    expect(body.error).toBeUndefined()
  })

  it('produces valid JSON for every value of every fixture', () => {
    for (const [component, props] of [
      [Single, {}],
      [MultiRoot, {}],
      [Child, { label: 'solo' }],
      [Props, { name: 'Prompt', count: 3 }],
      [BigState, { limit: 10 }],
      [Styled, {}],
      [Each, { items: ['one'] }],
    ] as const) {
      const view = render(component, props)
      try {
        const inspected = inspect(view.target.firstElementChild ?? view.target)

        for (const entry of inspected.components) {
          expect(() => jsonOf(entry.props)).not.toThrow()
          for (const node of entry.state) expect(() => jsonOf(node.value)).not.toThrow()
          expect(entry.renders).toBe(0)
        }
      } finally {
        view.destroy()
      }
    }
  })
})

describe('locateElement', () => {
  it('summarises the chain and keeps the location', () => {
    const view = render(MultiRoot)
    try {
      expect(locate(view.byTestId('child'))).toEqual({
        source: expect.objectContaining({ line: 5, enclosing: true }),
        component: { name: 'Child', file: expect.stringMatching(/Child\.svelte$/), depth: 2 },
      })

      expect(locate(view.byTestId('first'))?.component?.depth).toBe(1)
      expect(locate(document.createElement('div'))).toEqual({ source: null, component: null })
      expect(locate(null)).toEqual({ source: null, component: null })
    } finally {
      view.destroy()
    }
  })
})

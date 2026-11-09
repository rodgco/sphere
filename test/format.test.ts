import { describe, expect, it } from 'vitest'
import { PROMPT_LIMIT, formatPrompt, formatValue } from '../src/runtime/format.js'
import type { Inspected, PageInfo } from '../src/shared/payload.js'

const page: PageInfo = {
  url: 'http://localhost:3000/dashboard',
  path: '/dashboard',
  title: 'Home · App',
  viewport: '1269×919',
}

const options = { state: true, props: true, source: true, template: true }

function element(overrides: Partial<Inspected['element']> = {}): NonNullable<Inspected['element']> {
  return {
    tag: 'div',
    tagName: 'div',
    id: '',
    classes: ['connection-pill'],
    attrs: { 'aria-live': 'polite', title: 'Live status' },
    markup: '<div class="connection-pill" aria-live="polite"></div>',
    size: '219×37',
    selector: 'div.connection-pill',
    domPath: 'aside.sidebar > div:nth-of-type(1).connection-pill',
    ...overrides,
  }
}

function inspected(overrides: Partial<Inspected> = {}): Inspected {
  return {
    page,
    element: element(),
    source: { file: 'src/lib/SystemStatus.svelte', line: 41, column: 0, enclosing: false },
    template: [],
    components: [
      {
        id: 12,
        name: 'SystemStatus',
        file: 'src/lib/SystemStatus.svelte',
        usage: null,
        props: '{}',
        state: [{ name: 'tone', type: 'derived', value: '"ok"' }],
        renders: 0,
      },
    ],
    ...overrides,
  }
}

describe('formatValue', () => {
  it('inlines scalars, strings and small structures', () => {
    expect(formatValue('null')).toBe('null')
    expect(formatValue('false')).toBe('false')
    expect(formatValue('123')).toBe('123')
    expect(formatValue('"text"')).toBe('"text"')
    expect(formatValue('{"status":"ok","latencyMs":12}')).toBe('{status: "ok", latencyMs: 12}')
    expect(formatValue('[1, 2, 3]')).toBe('[1, 2, 3]')
    expect(formatValue('["a", "b"]')).toBe('["a", "b"]')
  })

  it('escapes keys that would otherwise start a new line', () => {
    expect(formatValue(JSON.stringify({ 'a\nb': 1 }))).toBe('{"a\\nb": 1}')
    expect(
      formatValue(
        JSON.stringify(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`k\n${i}`, i]))),
      ),
    ).toContain('"k\\n0"')
  })

  it('redacts sensitive keys in values', () => {
    expect(formatValue('{"email":"a@b.test","ok":1}')).toBe('{email: "<redacted>", ok: 1}')
  })

  it('quotes keys that are not identifiers', () => {
    expect(formatValue('{"a-b":1,"ok":2}')).toBe('{"a-b": 1, ok: 2}')
  })

  it('clips long strings inside the value', () => {
    const long = 'x'.repeat(80)
    expect(formatValue(JSON.stringify({ text: long }))).toContain('…')
  })

  it('shows six entries and says how many were left out', () => {
    const many = JSON.stringify(Array.from({ length: 9 }, (_, index) => index))
    expect(formatValue(many)).toBe('[0, 1, 2, 3, 4, 5, …3 more]')

    const wide = JSON.stringify(
      Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`k${i}`, i])),
    )
    expect(formatValue(wide)).toBe('{k0: 0, k1: 1, k2: 2, k3: 3, k4: 4, k5: 5, …2 more}')
  })

  it('falls back to structure when the inline form is too long', () => {
    const wide = JSON.stringify(
      Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`key${i}`, 'x'.repeat(60)])),
    )
    expect(formatValue(wide)).toBe('{key0, key1, key2, key3, key4, key5, …3 more}')

    const many = JSON.stringify(
      Array.from({ length: 12 }, (_, index) => ({ index, label: 'x'.repeat(60) })),
    )
    expect(formatValue(many)).toMatch(/^\[\d+ items\]$/)
  })

  it('does not go deeper than two levels', () => {
    expect(formatValue('{"a":{"b":{"c":1}}}')).toBe('{a: {b: {c}}}')
  })

  it('survives invalid JSON', () => {
    expect(formatValue('not json')).toBe('null')
  })
})

describe('formatPrompt', () => {
  it('starts with the page, the viewport and a section for the instructions', () => {
    const { text } = formatPrompt({ page, instructions: '', options, selections: [] })

    expect(text).toBe(
      [
        '# UI context from the running app',
        '',
        'Page: `http://localhost:3000/dashboard`',
        'Viewport: 1269×919',
        '',
        '## What I need',
        '',
        '(no instructions added — describe the change here)',
        '',
      ].join('\n'),
    )
  })

  it('never emits the document title, and adds the collection line only when asked', () => {
    const plain = formatPrompt({
      page,
      instructions: 'do it',
      options,
      selections: [],
    })
    expect(plain.text).toContain('Page: `http://localhost:3000/dashboard`\n')
    expect(plain.text).not.toContain('Home · App')
    expect(plain.text).not.toContain('Collected with')

    const versioned = formatPrompt({
      page,
      instructions: 'do it',
      options,
      selections: [],
      version: '0.1.0',
    })
    expect(versioned.text).toContain('Collected with: sphere 0.1.0')
  })

  it('strips the query, fragment and credentials from the page URL', () => {
    const { text } = formatPrompt({
      page: {
        ...page,
        url: 'https://user:pass@example.test/dashboard?token=abc#section',
      },
      instructions: 'do it',
      options,
      selections: [],
    })

    expect(text).toContain('Page: `https://example.test/dashboard`\n')
    expect(text).not.toContain('token=abc')
    expect(text).not.toContain('user:pass')
  })

  it('uses a fence longer than any backtick run in the markup', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            element: element({ markup: '<div data-x="a\n````\nb"></div>' }),
          }),
        },
      ],
    })

    expect(text).toMatch(/\n`````html\n/)
    expect(text).toContain('\n`````\n')
    expect(text).not.toMatch(/\n````html\n/)
  })

  it('keeps page-derived one-line fields on one line', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            element: element({
              id: 'a`b',
              attrs: { title: 'a\n```\nb' },
              markup: '<div></div>',
            }),
          }),
        },
      ],
    })

    expect(text).toContain('### Selected element div#a&#96;b.connection-pill')
    expect(text).toContain('- attributes: title="a &#96;&#96;&#96; b"')
  })

  it('formats one selection with identity, location, path, markup and chain', () => {
    const { text } = formatPrompt({
      page,
      instructions: 'Explain this component to me.',
      options,
      selections: [{ inspected: inspected() }],
    })

    expect(text).toContain('## Selection\n')
    expect(text).toContain('### Selected element div.connection-pill\n')
    expect(text).toContain('- markup: `src/lib/SystemStatus.svelte:41:0`')
    expect(text).toContain('- DOM path: `aside.sidebar > div:nth-of-type(1).connection-pill`')
    expect(text).toContain('- size: 219×37')
    expect(text).toContain('- attributes: aria-live="polite" title="Live status"')
    expect(text).toContain('```html\n<div class="connection-pill" aria-live="polite"></div>\n```')
    expect(text).toContain(
      'Component chain (innermost first):\n1. SystemStatus — `src/lib/SystemStatus.svelte`',
    )
    expect(text).toContain('  - $derived tone = "ok"')
    expect(text).not.toContain('Template context')
    expect(text).not.toContain('rendered text')
  })

  it('marks an approximate location with the note and drops the column', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            source: {
              file: 'src/routes/+page.svelte',
              line: 43,
              column: 4,
              enclosing: true,
            },
          }),
        },
      ],
    })

    expect(text).toContain('- markup: `src/routes/+page.svelte:43`')
    expect(text).toContain(
      "- location note: `src/routes/+page.svelte:43` is the enclosing element Svelte recorded; the element's own line was not found",
    )
  })

  it('says what matched when the element was found on another line', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            source: {
              file: 'src/routes/+page.svelte',
              line: 55,
              column: null,
              enclosing: false,
              matched: 'class="button button-quiet"',
              recorded: { file: 'src/routes/+page.svelte', line: 43 },
            },
          }),
        },
      ],
    })

    expect(text).toContain('- markup: `src/routes/+page.svelte:55`')
    expect(text).toContain(
      '- location note: line matched by `class="button button-quiet"`; Svelte recorded the enclosing element at `src/routes/+page.svelte:43`',
    )
  })

  it('prints absolute paths relative to the project root', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      root: '/home/me/app',
      selections: [
        {
          inspected: inspected({
            source: {
              file: '/home/me/app/src/lib/SystemStatus.svelte',
              line: 41,
              column: 0,
              enclosing: false,
            },
            components: [
              {
                id: 12,
                name: 'SystemStatus',
                file: '/home/me/app/src/lib/SystemStatus.svelte',
                usage: {
                  file: '/home/me/app/src/lib/AppSidebar.svelte',
                  line: 177,
                  column: 6,
                  componentTag: 'SystemStatus',
                },
                props: '{}',
                state: [],
                renders: 1,
              },
            ],
          }),
          source: {
            path: '/home/me/app/src/lib/SystemStatus.svelte',
            text: Array.from(
              { length: 60 },
              (_, index) => `let line${index + 1} = ${index + 1}`,
            ).join('\n'),
          },
        },
      ],
    })

    expect(text).toContain('- markup: `src/lib/SystemStatus.svelte:41:0`')
    expect(text).toContain('1. SystemStatus — `src/lib/SystemStatus.svelte`')
    expect(text).toContain('- rendered by `src/lib/AppSidebar.svelte:177:6`')
    expect(text).toContain('Source of `src/lib/SystemStatus.svelte`')
    expect(text).not.toContain('/home/me/app')
  })

  it('names and relativises Windows paths without leaking the machine path', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      root: 'C:\\Users\\me\\app',
      selections: [
        {
          inspected: inspected({
            source: {
              file: 'C:\\Users\\me\\app\\src\\Chip.svelte',
              line: 4,
              column: 2,
              enclosing: false,
            },
            components: [
              {
                id: 1,
                name: 'Chip',
                file: 'C:\\Users\\me\\app\\src\\Chip.svelte',
                usage: null,
                props: '{}',
                state: [],
                renders: 0,
              },
            ],
          }),
        },
      ],
    })

    expect(text).toContain('1. Chip — `src/Chip.svelte`')
    expect(text).toContain('- markup: `src/Chip.svelte:4:2`')
    expect(text).not.toContain('Users')
    expect(text).not.toContain('C:')
  })

  it('omits the markup line when nothing reliable was recorded', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        { inspected: inspected({ element: element({ id: '', classes: [] }), source: null }) },
      ],
    })

    expect(text).not.toContain('- markup:')
    expect(text).not.toContain('- location note:')
    expect(text).toContain('- DOM path:')
  })

  it('labels template frames the way the prompt reads them', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            template: [
              {
                type: 'component',
                file: 'src/AppSidebar.svelte',
                line: 177,
                column: 6,
                componentTag: 'SystemStatus',
              },
              {
                type: 'each',
                file: 'src/AppSidebar.svelte',
                line: 90,
                column: 2,
                componentTag: null,
              },
              {
                type: 'render',
                file: 'src/+layout.svelte',
                line: 25,
                column: 0,
                componentTag: null,
              },
            ],
          }),
        },
      ],
    })

    expect(text).toContain(
      [
        'Template context (innermost first):',
        '- <SystemStatus /> at `src/AppSidebar.svelte:177:6`',
        '- {#each} at `src/AppSidebar.svelte:90:2`',
        '- {@render} at `src/+layout.svelte:25:0`',
      ].join('\n'),
    )
  })

  it('drops node_modules frames and instances', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            template: [
              {
                type: 'component',
                file: 'node_modules/@sveltejs/kit/root.svelte',
                line: 1,
                column: 0,
                componentTag: 'Root',
              },
            ],
            components: [
              {
                id: 1,
                name: 'Root',
                file: 'node_modules/@sveltejs/kit/root.svelte',
                usage: null,
                props: '{}',
                state: [],
                renders: 0,
              },
            ],
          }),
        },
      ],
    })

    expect(text).not.toContain('Template context')
    expect(text).not.toContain('Component chain')
    expect(text).not.toContain('node_modules')
  })

  it('labels the head that renders markup another instance defines', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            source: { file: 'src/lib/Snippet.svelte', line: 7, column: 2, enclosing: false },
            template: [
              {
                type: 'component',
                file: 'src/lib/Host.svelte',
                line: 5,
                column: 0,
                componentTag: 'Host',
              },
            ],
            components: [
              {
                id: 2,
                name: 'Host',
                file: 'src/lib/Host.svelte',
                usage: { file: 'src/App.svelte', line: 9, column: 0, componentTag: 'Host' },
                props: '{}',
                state: [],
                renders: 0,
              },
              {
                id: 1,
                name: 'Snippet',
                file: 'src/lib/Snippet.svelte',
                usage: null,
                props: '{}',
                state: [],
                renders: 0,
              },
            ],
          }),
        },
      ],
    })

    expect(text).toContain('1. Host — `src/lib/Host.svelte` — renders the markup')
    expect(text).toContain('2. Snippet — `src/lib/Snippet.svelte` — defines the markup')
  })

  it('formats props in one line, keeping only what fits', () => {
    const long = 'x'.repeat(120)
    const props = JSON.stringify({
      user: { id: 1, name: 'Rodrigo', email: 'r@rodg.co', role: 'owner', createdAt: long },
      data: { locale: 'pt-BR', channels: [1, 2, 3], workspace: { id: 7, slug: 'acme' } },
      active: 'overview',
      $$slots: { default: true },
    })

    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected({
            components: [
              {
                id: 1,
                name: 'App',
                file: 'src/App.svelte',
                usage: null,
                props,
                state: [],
                renders: 3,
              },
            ],
          }),
        },
      ],
    })

    // The line fits the 400-char budget, so values stay inline (clipped inside a string).
    expect(text).toContain('  - props: user={id: 1, name: "Rodrigo"')
    expect(text).toContain('email: "<redacted>"')
    expect(text).not.toContain('r@rodg.co')
    expect(text).toContain('active="overview"')
    expect(text).not.toContain('$$slots')
    expect(text).toContain('  - renders: 3')
  })

  it('honours the options: each one removes exactly its section', () => {
    const selection = {
      inspected: inspected({
        template: [
          { type: 'component', file: 'src/App.svelte', line: 3, column: 0, componentTag: 'App' },
        ],
      }),
      source: { path: 'src/lib/SystemStatus.svelte', text: 'line one\nline two\n' },
    }

    const off = formatPrompt({
      page,
      instructions: '',
      options: { state: false, props: false, source: false, template: false },
      selections: [selection],
    }).text

    expect(off).not.toContain('$derived')
    expect(off).not.toContain('- props:')
    expect(off).not.toContain('Source of')
    expect(off).not.toContain('Template context')
    expect(off).toContain('### Selected element div.connection-pill')
  })

  it('prints a numbered source window with the reported line marked', () => {
    const text = Array.from(
      { length: 60 },
      (_, index) => `let line${index + 1} = ${index + 1}`,
    ).join('\n')

    const { text: prompt } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        {
          inspected: inspected(),
          source: { path: 'src/lib/SystemStatus.svelte', text },
        },
      ],
    })

    const lines = prompt.split('\n')
    const start = lines.findIndex((line) => line.startsWith('Source of'))
    expect(lines[start + 1]).toBe('```svelte')
    expect(lines[start + 2]).toBe('  33 | let line33 = 33')
    expect(lines).toContain('> 41 | let line41 = 41')
    expect(lines[start + 18]).toBe('  49 | let line49 = 49')
  })

  it('separates selections with a rule and keeps pick order', () => {
    const { text } = formatPrompt({
      page,
      instructions: '',
      options,
      selections: [
        { inspected: inspected({ element: element({ classes: ['first'] }) }) },
        { inspected: inspected({ element: element({ classes: ['second'] }) }) },
      ],
    })

    expect(text).toContain('### Selected element div.first')
    expect(text.indexOf('div.first')).toBeLessThan(text.indexOf('div.second'))
    expect(text).toMatch(/\n---\n\n### Selected element div\.second/)
  })

  it('never splits a surrogate pair at the cut', () => {
    const instructions = `${'x'.repeat(PROMPT_LIMIT - 500)}${'😀'.repeat(1_000)}`

    const result = formatPrompt({ page, instructions, options, selections: [] })

    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(PROMPT_LIMIT)
    expect(result.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
    expect(result.text).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
  })

  it('closes a code fence that the cut entered', () => {
    const markup = `\`\`\`html\n${'line\n'.repeat(20_000)}\`\`\``
    const result = formatPrompt({
      page,
      instructions: '',
      options: { state: false, props: false, source: false, template: false },
      selections: [{ inspected: inspected({ element: element({ markup }), components: [] }) }],
    })

    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(PROMPT_LIMIT)

    const body = result.text.slice(0, result.text.indexOf('\n\n(prompt truncated:'))
    expect((body.match(/^`{4,}html$/gm) ?? []).length).toBe(1)
    expect((body.match(/^`{4,}$/gm) ?? []).length).toBe(1)
  })

  it('truncates at the limit and says how long the original was', () => {
    const long = Array.from({ length: 150 }, () => ({
      inspected: inspected(),
    }))

    const result = formatPrompt({ page, instructions: '', options, selections: long })

    expect(result.truncated).toBe(true)
    expect(result.originalLength).toBeGreaterThan(PROMPT_LIMIT)
    expect(result.text.length).toBeLessThanOrEqual(PROMPT_LIMIT)
    expect(result.text.endsWith(`(prompt truncated: ${result.originalLength} chars)`)).toBe(true)
  })
})

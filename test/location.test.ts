import { describe, expect, it } from 'vitest'
import {
  matchSourceLine,
  opensElement,
  resolveElementSource,
  type LocatedElement,
  type RecordedLocation,
} from '../src/runtime/location.js'
import { createSourceLoader, readRawModule, sourceUrl } from '../src/runtime/source.js'

const element = (overrides: Partial<LocatedElement> = {}): LocatedElement => ({
  tag: 'a',
  classes: ['button', 'button-quiet'],
  id: '',
  attrs: { href: '/files' },
  ...overrides,
})

const recorded = (line: number | null, file = 'src/+page.svelte'): RecordedLocation => ({
  file,
  line,
  column: 4,
})

const file = (...lines: string[]) => lines.join('\n')

const PAGE = file(
  '<script lang="ts">',
  '  let open = $state(false)',
  '</script>',
  '',
  '<main class="app-main">',
  '  <section class="home-greeting">',
  '    <div class="page-actions">',
  '      <a class="button button-quiet" href="/files">open</a>',
  '      <a class="button" href="/agent">chat</a>',
  '    </div>',
  '  </section>',
  '</main>',
)

/** One row per line of docs/specs/location-resolution.md's test matrix. */
describe('resolveElementSource', () => {
  it('uses a verified line as-is, keeping the column', () => {
    const resolution = resolveElementSource({
      recorded: recorded(8),
      chainFile: null,
      element: element(),
      fileText: PAGE,
    })

    expect(resolution).toEqual({
      file: 'src/+page.svelte',
      line: 8,
      column: 4,
      enclosing: false,
      matched: null,
      recorded: null,
    })
  })

  it('finds the element when the compiler recorded an ancestor, and says what matched', () => {
    const resolution = resolveElementSource({
      recorded: recorded(7),
      chainFile: null,
      element: element(),
      fileText: PAGE,
    })

    expect(resolution).toMatchObject({
      line: 8,
      column: null,
      enclosing: false,
      matched: 'class="button button-quiet"',
      recorded: { file: 'src/+page.svelte', line: 7 },
    })
  })

  it('does not match on href when the element has authored classes', () => {
    const resolution = resolveElementSource({
      recorded: recorded(7),
      chainFile: null,
      element: element({ classes: ['button', 'primary'] }),
      fileText: PAGE,
    })

    expect(resolution).toMatchObject({ line: 7, column: null, enclosing: true, matched: null })
  })

  it('matches on an identifying attribute when the element has no classes', () => {
    const resolution = resolveElementSource({
      recorded: recorded(5),
      chainFile: null,
      element: element({ classes: [], attrs: { href: '/agent' } }),
      fileText: PAGE,
    })

    expect(resolution).toMatchObject({ line: 9, matched: 'href="/agent"', enclosing: false })
  })

  it('picks the occurrence closest to the compiler hint', () => {
    const lines = file(
      '<div class="spacer"></div>',
      '<button class="repeat">one</button>',
      '<div class="spacer"></div>',
      '<button class="repeat">two</button>',
    )
    const repeated = element({ tag: 'button', classes: ['repeat'], attrs: {} })

    expect(matchSourceLine(lines.split('\n'), repeated, 1)).toEqual({
      line: 2,
      basis: 'class="repeat"',
    })
    expect(matchSourceLine(lines.split('\n'), repeated, 4)).toEqual({
      line: 4,
      basis: 'class="repeat"',
    })
  })

  it('does not confuse <a with <aside>', () => {
    const lines = file(
      '  <aside class="button button-quiet">no</aside>',
      '<a class="button button-quiet">yes</a>',
    )

    expect(matchSourceLine(lines.split('\n'), element(), 1)).toEqual({
      line: 2,
      basis: 'class="button button-quiet"',
    })
    expect(opensElement('  <aside class="button button-quiet">', element())).toBe(false)
  })

  it('matches SVG tags case-insensitively, without building a RegExp from page text', () => {
    const svg = file('<svg>', '  <foreignObject class="icon" width="10"></foreignObject>', '</svg>')
    const icon = element({ tag: 'foreignObject', classes: ['icon'], attrs: {} })

    expect(matchSourceLine(svg.split('\n'), icon, 2)).toEqual({
      line: 2,
      basis: 'class="icon"',
    })
  })

  it('reports the enclosing element when nothing matches in the file', () => {
    const resolution = resolveElementSource({
      recorded: recorded(3),
      chainFile: null,
      element: element({ tag: 'button', classes: ['ghost'], attrs: {} }),
      fileText: PAGE,
    })

    expect(resolution).toMatchObject({
      line: 3,
      column: null,
      enclosing: true,
      matched: null,
      recorded: { file: 'src/+page.svelte', line: 3 },
    })
  })

  it('keeps the recorded line and the pessimistic flag when there is no file text', () => {
    const resolution = resolveElementSource({
      recorded: recorded(8),
      chainFile: null,
      element: element(),
      fileText: null,
    })

    expect(resolution).toMatchObject({ line: 8, column: 4, enclosing: true, matched: null })
  })

  it('falls back to the chain file and still searches when nothing was recorded', () => {
    const resolution = resolveElementSource({
      recorded: null,
      chainFile: 'src/+page.svelte',
      element: element(),
      fileText: PAGE,
    })

    expect(resolution).toMatchObject({
      file: 'src/+page.svelte',
      line: 8,
      enclosing: false,
      matched: 'class="button button-quiet"',
    })
  })

  it('says nothing when there is neither a recorded location nor a chain file', () => {
    expect(
      resolveElementSource({ recorded: null, chainFile: null, element: element(), fileText: PAGE }),
    ).toBeNull()
  })
})

describe('opensElement', () => {
  it('requires the tag and the exact authored class list', () => {
    expect(opensElement('<a class="button button-quiet" href="/x">', element())).toBe(true)
    expect(opensElement('<a class="button" href="/x">', element())).toBe(false)
    // A prefix of the class list is not the class list.
    expect(opensElement('<a class="button button-quiet-more">', element())).toBe(false)
  })

  it('accepts a classless element by its tag alone', () => {
    expect(opensElement('<button type="submit">', element({ tag: 'button', classes: [] }))).toBe(
      true,
    )
  })
})

describe('source loader', () => {
  const config = { root: '/app', base: '/' }

  it('builds an @fs URL, with the base when there is one', () => {
    expect(sourceUrl('src/App.svelte', config)).toBe('/@fs/app/src/App.svelte?raw')
    expect(sourceUrl('/app/src/App.svelte', config)).toBe('/@fs/app/src/App.svelte?raw')
    expect(sourceUrl('src/App.svelte', { root: '/app/', base: '/base/' })).toBe(
      '/base/@fs/app/src/App.svelte?raw',
    )
  })

  it('unwraps the raw module the dev server returns', () => {
    expect(readRawModule('export default "hello\\nworld";')).toBe('hello\nworld')
    expect(readRawModule('export default "a \\"quoted\\" line";')).toBe('a "quoted" line')
    // Not a raw module: keep it, so a misconfigured server is visible rather than silent.
    expect(readRawModule('<html>404</html>')).toBe('<html>404</html>')
  })

  it('fetches a file once and caches the answer', async () => {
    const calls: string[] = []
    const loader = createSourceLoader({
      ...config,
      fetcher: async (url) => {
        calls.push(url)
        return { ok: true, text: async () => 'export default "text";' }
      },
    })

    expect(await loader('src/App.svelte')).toBe('text')
    expect(await loader('src/App.svelte')).toBe('text')
    expect(calls).toEqual(['/@fs/app/src/App.svelte?raw'])
  })

  it('degrades to null when the read is denied, missing or throwing', async () => {
    const denied = createSourceLoader({
      ...config,
      fetcher: async () => ({ ok: false, text: async () => '' }),
    })
    const broken = createSourceLoader({
      ...config,
      fetcher: async () => {
        throw new Error('offline')
      },
    })
    const unreadable = createSourceLoader({
      ...config,
      fetcher: async () => ({
        ok: true,
        text: async () => {
          throw new Error('stream')
        },
      }),
    })

    expect(await denied('src/App.svelte')).toBeNull()
    expect(await broken('src/App.svelte')).toBeNull()
    expect(await unreadable('src/App.svelte')).toBeNull()
  })
})

/**
 * Location resolution: what the prompt reports, and why.
 *
 * Svelte assigns element locations positionally while the DOM is created, and during hydration it
 * walks the existing DOM, so a recorded line can belong to an ancestor (see
 * `docs/learning/svelte-internals.md` §3). The rule is that a line is used **as-is only if it
 * verifies** against the file; otherwise the element is searched for, and if that fails the
 * compiler's line is reported as the enclosing element. A wrong line in a prompt is worse than an
 * honest "approximate", so every step here prefers saying less.
 *
 * Normative: `docs/specs/location-resolution.md`.
 */

export interface LocatedElement {
  tag: string
  classes: readonly string[]
  id: string
  attrs: Record<string, string>
}

export interface RecordedLocation {
  file: string | null
  line: number | null
  column: number | null
}

export interface Resolution {
  file: string | null
  line: number | null
  column: number | null
  /** True when the reported line is the ancestor the compiler recorded, not the element. */
  enclosing: boolean
  /** The need that matched, e.g. `class="button primary"`; null when verified or enclosing. */
  matched: string | null
  /** What the compiler said, kept so the note can name it. */
  recorded: { file: string | null; line: number | null } | null
}

export interface ResolutionInput {
  recorded: RecordedLocation | null
  /** `components[0].file`, used when the element has no recorded location at all. */
  chainFile: string | null
  element: LocatedElement | null
  /** The file's text, when it could be read (M4). */
  fileText: string | null
}

/** Attributes that may identify an element when it has no authored classes. */
const IDENTIFYING_ATTRIBUTES = [
  'href',
  'type',
  'name',
  'aria-label',
  'title',
  'placeholder',
  'value',
  'src',
] as const

export function resolveElementSource(input: ResolutionInput): Resolution | null {
  const path = input.recorded?.file ?? input.chainFile
  if (path === null || path === undefined) return null

  const result: Resolution = {
    file: path,
    line: input.recorded?.line ?? null,
    column: input.recorded?.column ?? null,
    // Pessimistic until proven otherwise: the compiler's line is the ancestor's until checked.
    enclosing: input.recorded?.line != null,
    matched: null,
    recorded: null,
  }

  if (input.fileText === null || input.element === null) return result

  const lines = input.fileText.split(/\r?\n/)
  const hint = result.line
  const ignored = ignoredLines(lines)
  const hintBlock =
    hint !== null && hint >= 1 && hint <= lines.length && ignored[hint - 1] !== true
      ? tagBlockAt(lines, hint - 1)
      : null

  if (hintBlock !== null && opensElementBlock(hintBlock, input.element)) {
    result.enclosing = false
    return result
  }

  const match = matchSourceLine(lines, input.element, hint)
  if (match !== null) {
    result.line = match.line
    result.column = null
    result.matched = match.basis
    result.enclosing = false
    result.recorded = { file: path, line: hint }
    return result
  }

  if (result.enclosing) {
    result.column = null
    result.recorded = { file: path, line: hint }
  }

  return result
}

/** Whether `line` opens this element's tag and carries its identity. */
export function opensElement(line: string, element: LocatedElement): boolean {
  return opensElementBlock(line, element)
}

/**
 * The same check on a tag that may span lines. A classless element needs an identifying
 * attribute — a bare same-tag line is not enough to call the compiler's line verified.
 */
export function opensElementBlock(block: string, element: LocatedElement): boolean {
  if (!opensTag(block.trimStart(), element.tag)) return false
  if (element.classes.length > 0) return hasAttribute(block, 'class', element.classes.join(' '))

  return identifiersFor(element).some((needle) => hasNeedle(block, needle))
}

/**
 * Candidate needles, in the order `docs/specs/location-resolution.md` fixes: the class list, the
 * id, then identifying attributes — and attributes only for an element with no authored classes,
 * because a shared `href` is not identity.
 */
export function identifiersFor(element: LocatedElement): string[] {
  if (element.classes.length > 0)
    return [`class="${element.classes.join(' ')}"`, ...(element.id ? [`id="${element.id}"`] : [])]

  const identifiers: string[] = []
  if (element.id !== '') identifiers.push(`id="${element.id}"`)

  for (const name of IDENTIFYING_ATTRIBUTES) {
    const value = element.attrs[name]
    if (value !== undefined && value !== '') identifiers.push(`${name}="${value}"`)
  }

  return identifiers
}

export interface LineMatch {
  line: number
  basis: string
}

export function matchSourceLine(
  lines: readonly string[],
  element: LocatedElement,
  hint: number | null,
): LineMatch | null {
  const ignored = ignoredLines(lines)

  for (const needle of identifiersFor(element)) {
    const hits: number[] = []

    for (const [index, line] of lines.entries()) {
      if (ignored[index] === true) continue
      const trimmed = line.trimStart()
      if (!opensTag(trimmed, element.tag)) continue

      const block = tagBlockAt(lines, index)
      if (block === null || !hasNeedle(block, needle)) continue
      hits.push(index + 1)
    }

    if (hits.length === 0) continue

    // Elements repeat; the occurrence closest to the compiler's hint is the best disambiguator.
    const line =
      hint === null
        ? hits[0]!
        : hits.reduce((best, current) =>
            Math.abs(current - hint) < Math.abs(best - hint) ? current : best,
          )

    return { line, basis: needle }
  }

  return null
}

/** A tag can wrap across lines; join until the first unquoted `>`, bounded. */
function tagBlockAt(lines: readonly string[], index: number): string | null {
  const first = lines[index] ?? ''
  if (!/^\s*<[A-Za-z]/.test(first)) return null

  let block = ''
  let quote: string | null = null

  for (let cursor = index; cursor < lines.length && cursor < index + 12; cursor += 1) {
    const line = lines[cursor] ?? ''
    block += cursor === index ? line : `\n${line}`

    for (const character of line) {
      if (quote !== null) {
        if (character === quote) quote = null
        continue
      }
      if (character === '"' || character === "'") {
        quote = character
        continue
      }
      if (character === '>') return block
    }
  }

  return block
}

/** Lines inside `<script>`/`<style>` look like markup to a line scanner; they are not. */
function ignoredLines(lines: readonly string[]): boolean[] {
  const ignored: boolean[] = []
  let raw: 'script' | 'style' | null = null

  for (const [index, line] of lines.entries()) {
    if (raw !== null) {
      ignored[index] = true
      if (line.toLowerCase().includes(`</${raw}`)) raw = null
      continue
    }

    const open = /<\s*(script|style)\b/i.exec(line)
    if (open === null) continue

    ignored[index] = true
    const name = open[1]?.toLowerCase() === 'style' ? 'style' : 'script'
    if (!line.toLowerCase().includes(`</${name}`)) raw = name
  }

  return ignored
}

/** An exact `name="value"` (or single-quoted) attribute, with a real name boundary. */
function hasNeedle(block: string, needle: string): boolean {
  const equals = needle.indexOf('="')
  if (equals === -1) return false

  const name = needle.slice(0, equals)
  const value = needle.slice(equals + 2, -1)
  return hasAttribute(block, name, value)
}

function hasAttribute(block: string, name: string, value: string): boolean {
  const lower = block.toLowerCase()
  const wanted = name.toLowerCase()
  let from = 0

  while (from < lower.length) {
    const index = lower.indexOf(wanted, from)
    if (index === -1) return false
    from = index + wanted.length

    if (index > 0 && !/[\s<]/.test(block[index - 1] ?? '')) continue

    let cursor = from
    while (/\s/.test(block[cursor] ?? '')) cursor += 1
    if (block[cursor] !== '=') continue

    cursor += 1
    while (/\s/.test(block[cursor] ?? '')) cursor += 1

    const quote = block[cursor]
    if (quote !== '"' && quote !== "'") continue

    const start = cursor + 1
    const end = block.indexOf(quote, start)
    if (end === -1) continue
    if (block.slice(start, end) === value) return true
  }

  return false
}

/** `<tag` followed by a space, `>`, `/` or the end of the tag name; case-insensitive for SVG. */
export function opensTag(trimmedLine: string, tag: string): boolean {
  if (!trimmedLine.startsWith('<')) return false

  const head = trimmedLine.slice(1, 1 + tag.length)
  if (head.toLowerCase() !== tag.toLowerCase()) return false

  const next = trimmedLine[1 + tag.length]
  return next === undefined || next === ' ' || next === '>' || next === '/' || next === '\n'
}

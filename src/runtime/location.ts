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

  if (
    hint !== null &&
    hint >= 1 &&
    hint <= lines.length &&
    opensElement(lines[hint - 1] ?? '', input.element)
  ) {
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

/** Whether `line` opens this element's tag and carries its authored class list. */
export function opensElement(line: string, element: LocatedElement): boolean {
  const trimmed = line.trimStart()
  if (!opensTag(trimmed, element.tag)) return false
  if (element.classes.length === 0) return true

  return trimmed.includes(`class="${element.classes.join(' ')}"`)
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
  for (const needle of identifiersFor(element)) {
    const hits: number[] = []

    for (const [index, line] of lines.entries()) {
      const trimmed = line.trimStart()
      if (!opensTag(trimmed, element.tag)) continue
      if (!line.includes(needle)) continue
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

/** `<tag` followed by a space, `>`, `/` or the end of the tag name; case-insensitive for SVG. */
export function opensTag(trimmedLine: string, tag: string): boolean {
  if (!trimmedLine.startsWith('<')) return false

  const head = trimmedLine.slice(1, 1 + tag.length)
  if (head.toLowerCase() !== tag.toLowerCase()) return false

  const next = trimmedLine[1 + tag.length]
  return next === undefined || next === ' ' || next === '>' || next === '/' || next === '\n'
}

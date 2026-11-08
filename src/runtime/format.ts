import { relativeTo, type RelativePath } from '../shared/paths.js'
import type {
  ComponentInfo,
  ElementInfo,
  Inspected,
  PageInfo,
  SourceLocation,
  StateNode,
  TemplateFrame,
} from '../shared/payload.js'

/**
 * Payload → the clipboard document. Pure: no DOM, no clipboard, no clock.
 *
 * The shape is normative in `docs/05-prompt-format.md`; the golden test compares this module's
 * output byte for byte. Two rules run through everything here:
 *
 * - **No rendered text and no absolute paths.** The prompt is read by models and humans, and the
 *   app's copy is neither identity nor machine-independent.
 * - **Mark uncertainty, never guess.** An approximate location keeps the `~` in its note, a value
 *   that did not fit says how much was left out, and a prompt that was cut says so at the end.
 */

/** The document cap from docs/05 §1. */
export const PROMPT_LIMIT = 60_000

/** §3: inline budget per value. */
const VALUE_LIMIT = 240
const VALUE_ENTRIES = 6
const VALUE_DEPTH = 2
const VALUE_STRING = 40

/** §2: props line budget. */
const PROPS_LIMIT = 400

/** §2: attributes shown per element, and frames of template context. */
const ATTRIBUTES_LIMIT = 12
const TEMPLATE_LIMIT = 8

/** `line ± 8`, so 24 lines at most (§2). */
const SOURCE_RADIUS = 8
const SOURCE_LINES = SOURCE_RADIUS * 2 + 1

export interface PromptSelection {
  inspected: Inspected
  /** The file the location points at, with its text, when it could be read (M4). */
  source?: { path: string; text: string }
}

export interface PromptOptions {
  state: boolean
  props: boolean
  source: boolean
  template: boolean
}

export interface PromptInput {
  page: PageInfo
  instructions: string
  options: PromptOptions
  selections: readonly PromptSelection[]
  /** Rendered as `Collected with: sphere <version>` when present. */
  version?: string
  /** Absolute project root; absolute file paths are printed relative to it (docs/05 §6). */
  root?: string
}

type Path = RelativePath

export interface FormattedPrompt {
  text: string
  truncated: boolean
  /** Length before truncation, for the notice and the status line. */
  originalLength: number
}

const PLACEHOLDER = '(no instructions added — describe the change here)'

export function formatPrompt(input: PromptInput): FormattedPrompt {
  const parts: string[] = [header(input), instructions(input.instructions)]
  const path = makePath(input.root)

  if (input.selections.length > 0) {
    parts.push('## Selection')
    parts.push(
      input.selections
        .map((selection) => formatSelection(selection, input.options, path))
        .join('\n---\n\n'),
    )
  }

  const document = `${parts.join('\n\n')}\n`
  return truncate(document)
}

function truncate(document: string): FormattedPrompt {
  if (document.length <= PROMPT_LIMIT) {
    return { text: document, truncated: false, originalLength: document.length }
  }

  const notice = `\n\n(prompt truncated: ${document.length} chars)`
  return {
    text: `${document.slice(0, PROMPT_LIMIT)}${notice}`,
    truncated: true,
    originalLength: document.length,
  }
}

function header(input: PromptInput): string {
  const { page } = input
  const title = page.title === '' ? '' : ` (${page.title})`

  const lines = [
    '# UI context from the running app',
    '',
    `Page: \`${page.url}\`${title}`,
    `Viewport: ${page.viewport}`,
  ]

  if (input.version !== undefined && input.version !== '') {
    lines.push(`Collected with: sphere ${input.version}`)
  }

  return lines.join('\n')
}

function instructions(text: string): string {
  const body = text.trim() === '' ? PLACEHOLDER : text.trimEnd()
  return `## What I need\n\n${body}`
}

// ---------------------------------------------------------------------------------------
// One selection
// ---------------------------------------------------------------------------------------

export function formatSelection(
  selection: PromptSelection,
  options: PromptOptions,
  path: Path = makePath(undefined),
): string {
  const { inspected, source } = selection
  const element = inspected.element
  if (element === null) return selectionError(inspected)

  const blocks: string[] = [heading(element), bullets(element, inspected.source, path).join('\n')]

  blocks.push(['```html', element.markup, '```'].join('\n'))

  if (options.template) {
    const template = templateSection(inspected.template, path)
    if (template !== '') blocks.push(template)
  }

  const chain = chainSection(inspected.components, inspected.source, options, path)
  if (chain !== '') blocks.push(chain)

  if (options.source) {
    const window = sourceWindow(source, inspected.source, path)
    if (window !== '') blocks.push(window)
  }

  return blocks.join('\n\n')
}

function selectionError(inspected: Inspected): string {
  const reason = inspected.error ?? 'the element could not be inspected'
  return `### Selected element <unknown>\n\nCould not inspect this element: ${reason}`
}

function heading(element: ElementInfo): string {
  const identity = `${element.tag}${element.id === '' ? '' : `#${element.id}`}${element.classes
    .map((name) => `.${name}`)
    .join('')}`

  return `### Selected element ${identity}`
}

function bullets(element: ElementInfo, source: SourceLocation | null, path: Path): string[] {
  const lines: string[] = []

  const markup = markupLine(source, path)
  if (markup !== null) lines.push(`- markup: ${markup}`)

  const note = locationNote(source, path)
  if (note !== null) lines.push(`- location note: ${note}`)

  lines.push(`- DOM path: \`${element.domPath}\``)
  lines.push(`- size: ${element.size}`)

  const attributes = attributesLine(element)
  if (attributes !== null) lines.push(`- attributes: ${attributes}`)

  return lines
}

/** `file:line:col` when verified, `file:line` when Svelte only recorded an ancestor. */
function markupLine(source: SourceLocation | null, path: Path): string | null {
  if (source === null || source.file === null || source.line === null) return null

  const place = `${path(source.file)}:${source.line}`
  const withColumn =
    source.enclosing === true || source.column === null ? place : `${place}:${source.column}`
  return `\`${withColumn}\``
}

function locationNote(source: SourceLocation | null, path: Path): string | null {
  if (source === null || source.file === null || source.line === null) return null

  if (typeof source.matched === 'string' && source.matched !== '') {
    const recorded = source.recorded ?? { file: source.file, line: null }
    return `line matched by \`${source.matched}\`; Svelte recorded the enclosing element at \`${path(recorded.file)}:${recorded.line ?? ''}\``
  }

  if (source.enclosing !== true) return null

  return `\`${path(source.file)}:${source.line}\` is the enclosing element Svelte recorded; the element's own line was not found`
}

function attributesLine(element: ElementInfo): string | null {
  const entries = Object.entries(element.attrs).slice(0, ATTRIBUTES_LIMIT)
  if (entries.length === 0) return null

  return entries.map(([name, value]) => `${name}="${value}"`).join(' ')
}

function templateSection(frames: readonly TemplateFrame[], path: Path): string {
  const visible = frames
    .filter((frame) => frame.file !== null && !frame.file.includes('node_modules'))
    .slice(0, TEMPLATE_LIMIT)

  if (visible.length === 0) return ''

  const lines = visible.map((frame) => {
    const where = [path(frame.file), frame.line, frame.column]
      .filter((part) => part !== null)
      .join(':')
    return `- ${frameLabel(frame)} at \`${where}\``
  })

  return ['Template context (innermost first):', ...lines].join('\n')
}

function frameLabel(frame: TemplateFrame): string {
  switch (frame.type) {
    case 'component':
      return `<${frame.componentTag ?? 'component'} />`
    case 'if':
      return '{#if}'
    case 'each':
      return '{#each}'
    case 'await':
      return '{#await}'
    case 'key':
      return '{#key}'
    case 'render':
      return '{@render}'
    case 'snippet':
      return '{#snippet}'
    case 'boundary':
      return '<svelte:boundary>'
    default:
      return frame.type
  }
}

function chainSection(
  components: readonly ComponentInfo[],
  elementSource: SourceLocation | null,
  options: PromptOptions,
  path: Path,
): string {
  const visible = components.filter((component) => !component.file.includes('node_modules'))
  if (visible.length === 0) return ''

  const elementFile = elementSource?.file ?? null
  const definer =
    elementFile === null ? -1 : visible.findIndex((component) => component.file === elementFile)

  const entries = visible.map((component, index) => {
    const lines = [
      `${index + 1}. ${component.name} — \`${path(component.file)}\`${role(index, definer)}`,
    ]

    if (component.usage !== null && component.usage.file !== null) {
      const where = [path(component.usage.file), component.usage.line, component.usage.column]
        .filter((part) => part !== null)
        .join(':')
      lines.push(`  - rendered by \`${where}\``)
    }

    if (component.renders > 0) lines.push(`  - renders: ${component.renders}`)

    if (options.props && component.props !== null && component.props !== 'null') {
      const props = propsLine(component.props)
      if (props !== '') lines.push(`  - props: ${props}`)
    }

    if (options.state) {
      for (const node of component.state) lines.push(stateLine(node))
    }

    return lines.join('\n')
  })

  return ['Component chain (innermost first):', ...entries].join('\n')
}

/** §2: the head renders the markup, the instance matching the element's file defines it. */
function role(index: number, definer: number): string {
  if (definer <= 0) return ''
  if (index === 0) return ' — renders the markup'
  if (index === definer) return ' — defines the markup'
  return ''
}

function propsLine(json: string): string {
  const value = parseJson(json)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ''

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key]) => key !== '$$slots',
  )
  if (entries.length === 0) return '{}'

  const inlineLine = entries.map(([key, item]) => `${key}=${inline(item)}`).join(', ')
  if (inlineLine.length <= PROPS_LIMIT) return inlineLine

  // §3: past the budget a value shows structure only, so the line stays about identity.
  const structured = entries.map(([key, item]) => `${key}=${structureOf(item)}`).join(', ')
  return structured.length <= PROPS_LIMIT ? structured : `${structured.slice(0, PROPS_LIMIT - 1)}…`
}

/** Keys for an object, count for an array, the inline form for anything else. */
function structureOf(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object' && value !== null)
    return structure(value as Record<string, unknown>)
  return inline(value)
}

function stateLine(node: StateNode): string {
  const kind = node.type === 'derived' ? '$derived' : '$state'
  return `  - ${kind} ${node.name} = ${formatValue(node.value)}`
}

// ---------------------------------------------------------------------------------------
// Values (§3)
// ---------------------------------------------------------------------------------------

/** Absolute paths are printed relative to the project root (`docs/05` §6). */
const makePath = relativeTo

export function formatValue(json: string): string {
  return inline(parseJson(json))
}

function inline(value: unknown): string {
  const text = summarise(value, 0, VALUE_LIMIT)
  return text
}

function summarise(value: unknown, depth: number, budget: number): string {
  if (value === null) return 'null'

  switch (typeof value) {
    case 'string':
      return JSON.stringify(clip(value, VALUE_STRING))
    case 'number':
    case 'boolean':
      return String(value)
    case 'undefined':
      return 'null'
    default:
      break
  }

  if (Array.isArray(value)) {
    const head = value.slice(0, VALUE_ENTRIES).map((item) => summarise(item, depth + 1, budget))
    const inlineArray = `[${head.join(', ')}${value.length > head.length ? `, …${value.length - head.length} more` : ''}]`
    if (depth >= VALUE_DEPTH || inlineArray.length > budget) return `[${value.length} items]`
    return inlineArray
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, VALUE_ENTRIES)
    if (depth >= VALUE_DEPTH) return structure(value as Record<string, unknown>)

    const parts = entries.map(
      ([key, item]) => `${keyPart(key)}: ${summarise(item, depth + 1, budget)}`,
    )
    const rest = Object.keys(value as Record<string, unknown>).length - entries.length
    const inlineObject = `{${parts.join(', ')}${rest > 0 ? `, …${rest} more` : ''}}`
    if (inlineObject.length > budget) return structure(value as Record<string, unknown>)
    return inlineObject
  }

  return 'null'
}

/** Structure only: `{id, name, …3 more}` / `[12 items]`. */
function structure(value: Record<string, unknown>): string {
  const keys = Object.keys(value)
  const shown = keys.slice(0, VALUE_ENTRIES)
  const rest = keys.length - shown.length

  if (shown.length === 0) return '{}'
  return `{${shown.join(', ')}${rest > 0 ? `, …${rest} more` : ''}}`
}

function keyPart(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
}

function clip(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------
// Source window (§2)
// ---------------------------------------------------------------------------------------

function sourceWindow(
  source: { path: string; text: string } | undefined,
  location: SourceLocation | null,
  path: Path,
): string {
  if (source === undefined || location?.line === null || location?.line === undefined) return ''

  const lines = source.text.split(/\r?\n/)
  const line = location.line
  if (line < 1 || line > lines.length) return ''

  const first = Math.max(1, line - SOURCE_RADIUS)
  const last = Math.min(lines.length, first + SOURCE_LINES - 1)
  const width = String(last).length

  const body = lines.slice(first - 1, last).map((text, index) => {
    const number = first + index
    const marker = number === line ? '>' : ' '
    // No trailing spaces anywhere in the document (docs/05 §1), so empty source lines end at `|`.
    return `${marker} ${String(number).padStart(width)} | ${text}`.trimEnd()
  })

  const file = location.file ?? source.path
  return [`Source of \`${path(file)}\`:`, `\`\`\`${languageOf(file)}`, ...body, '```'].join('\n')
}

function languageOf(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  switch (extension) {
    case 'svelte':
      return 'svelte'
    case 'ts':
    case 'mts':
    case 'cts':
      return 'ts'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'js'
    case 'css':
      return 'css'
    case 'json':
      return 'json'
    default:
      return ''
  }
}

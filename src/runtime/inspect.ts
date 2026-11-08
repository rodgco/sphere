import { LIMITS, NOT_EVALUATED, cloneToJson, clip, createBudget } from './budgets.js'
import { VERSION } from '../shared/version.js'
import type {
  ComponentInfo,
  ElementInfo,
  Inspected,
  Located,
  PageInfo,
  SourceLocation,
  SphereApi,
  StateNode,
  TemplateFrame,
} from '../shared/payload.js'

/**
 * Node → payload. The only module that reads `__svelte_meta`, and the only one that decides
 * what an element *is*; the formatter (M3) never touches the DOM.
 *
 * Nothing here throws: every failure becomes `{ error }`, because this runs inside a click
 * handler in someone's dev server (`docs/04-element-inspection.md` §7).
 */

/**
 * Structural mirrors of the instrumentation's types. Declared here so `inspect` does not
 * import `instrumentation` at runtime: the dependency goes one way (instrumentation installs
 * the API), which keeps the module graph acyclic.
 */
export interface FrameLike {
  readonly type: string
  readonly file: string | undefined
  readonly line: number
  readonly column: number
  readonly componentTag: string | undefined
  readonly parent: FrameLike | null
}

export interface StateLike {
  readonly name: string
  readonly kind: 'signal' | 'value'
  readonly source: unknown
}

export interface InstanceLike {
  readonly id: number
  readonly file: string | undefined
  readonly name: string
  readonly parent: InstanceLike | null
  readonly usage: FrameLike | null
  readonly props: Record<string, unknown> | null
  readonly state: Map<string, StateLike>
}

export interface InspectorAccess {
  instanceOf(node: Node | null): InstanceLike | null
  frameOf(node: Node | null): FrameLike | null
}

/** Svelte's dev metadata, assigned to located elements (`dev/elements.js`). */
interface SvelteMeta {
  loc?: { file?: string; line?: number; column?: number }
  parent?: DevFrame | null
}

interface DevFrame {
  type: string
  file: string
  line: number
  column: number
  componentTag?: string
  parent: DevFrame | null
}

let access: InspectorAccess = { instanceOf: () => null, frameOf: () => null }

/**
 * Installs `window.__SPHERE__` once. Called from the instrumentation module, so the API exists
 * exactly when Sphere is in the graph; with no stamps (Svelte too new) it still answers with
 * element identity.
 */
export function installSphereApi(inspector: InspectorAccess): SphereApi {
  access = inspector

  const api: SphereApi = {
    version: VERSION,
    inspectElement,
    locateElement,
  }

  if (typeof window !== 'undefined' && !window.__SPHERE__) window.__SPHERE__ = api

  return api
}

export function inspectElement(node: Node | null): Inspected {
  const page = pageInfo()

  try {
    const element = nearestElement(node)
    if (!element) return empty(page)

    const budget = createBudget()
    const meta = nearestMeta(element)
    const instance = access.instanceOf(element)

    return {
      page,
      element: elementInfo(element),
      source: sourceOf(meta),
      template: templateOf(meta, element),
      components: chainOf(instance, budget),
    }
  } catch (error) {
    return { ...empty(page), error: message(error) }
  }
}

/** Hover path: the same location, plus the one line the tooltip needs. */
export function locateElement(node: Node | null): Located {
  try {
    const element = nearestElement(node)
    if (!element) return { source: null, component: null }

    const instance = access.instanceOf(element)
    let depth = 0
    for (let cursor = instance; cursor !== null; cursor = cursor.parent) depth += 1

    return {
      source: sourceOf(nearestMeta(element)),
      component: instance ? { name: instance.name, file: instance.file ?? null, depth } : null,
    }
  } catch {
    return { source: null, component: null }
  }
}

// ---------------------------------------------------------------------------------------
// Element identity
// ---------------------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** Svelte's scoping class: `svelte-1a2b3c`. */
const SVELTE_HASH = /^svelte-[a-z0-9]+$/i

/**
 * Attribute names that never reach the payload, whatever their value
 * (`docs/09-security-and-privacy.md` §3). A token pasted into a data attribute is still a token.
 */
const SENSITIVE_ATTRIBUTE = /token|secret|password|api[-_]?key|authorization/i

/** A password field's `value` attribute can carry the typed value after a submit. */
function isSensitiveAttribute(element: Element, name: string): boolean {
  if (SENSITIVE_ATTRIBUTE.test(name)) return true
  return (
    name === 'value' && element.localName === 'input' && element.getAttribute('type') === 'password'
  )
}

function elementInfo(element: Element): ElementInfo {
  const classes = [...element.classList].filter((name) => !SVELTE_HASH.test(name))

  return {
    tag: element.localName,
    tagName: element.tagName,
    id: element.id,
    classes,
    attrs: attributesOf(element),
    markup: markupOf(element),
    size: `${Math.round(element.getBoundingClientRect().width)}×${Math.round(
      element.getBoundingClientRect().height,
    )}`,
    selector: selectorOf(element),
    domPath: selectorOf(element, { nthOfType: true }),
  }
}

function attributesOf(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {}
  let kept = 0

  for (const attribute of element.attributes) {
    if (kept >= LIMITS.attrs) break
    // Already visible in `markup`, and the two big ones.
    if (attribute.name === 'class' || attribute.name === 'style') continue
    if (isSensitiveAttribute(element, attribute.name)) continue
    attrs[attribute.name] = clip(attribute.value, LIMITS.attrLength)
    kept += 1
  }

  return attrs
}

/** Tags and attributes only: rendered text is page copy, not identity. */
function markupOf(element: Element): string {
  const markup = serializeElement(element, 0)
  if (markup.length <= LIMITS.markupLength) return markup

  const cut = markup.lastIndexOf('>', LIMITS.markupLength)
  return `${markup.slice(0, cut > 0 ? cut + 1 : LIMITS.markupLength)}…`
}

function serializeElement(element: Element, depth: number): string {
  const tag = element.localName
  const open = `<${tag}${serializeAttributes(element)}>`
  if (VOID_ELEMENTS.has(tag)) return open
  if (depth >= LIMITS.markupDepth) return `${open}…</${tag}>`

  const children = [...element.children].slice(0, LIMITS.markupChildren)
  const inner = children.map((child) => serializeElement(child, depth + 1)).join('')

  return `${open}${inner}</${tag}>`
}

function serializeAttributes(element: Element): string {
  let out = ''

  for (const attribute of element.attributes) {
    if (attribute.name === 'style') continue
    if (isSensitiveAttribute(element, attribute.name)) continue
    let value = clip(attribute.value, LIMITS.attrLength)
    if (attribute.name === 'class') {
      const authored = value
        .split(/\s+/)
        .filter((name) => name !== '' && !SVELTE_HASH.test(name))
        .join(' ')
      if (authored === '') continue
      value = authored
    }
    out += ` ${attribute.name}="${value.replaceAll('"', '&quot;')}"`
  }

  return out
}

function selectorOf(element: Element, options: { nthOfType?: boolean } = {}): string {
  const parts: string[] = []

  for (
    let cursor: Element | null = element;
    cursor !== null && parts.length < LIMITS.selectorDepth;
    cursor = cursor.parentElement
  ) {
    if (cursor === document.documentElement || cursor === document.body) break

    const classes = [...cursor.classList]
      .filter((name) => !SVELTE_HASH.test(name))
      .map((name) => `.${name}`)
      .join('')

    let suffix = ''
    if (options.nthOfType === true) {
      const sameTag = cursor.parentElement
        ? [...cursor.parentElement.children].filter(
            (child) => child.localName === cursor?.localName,
          )
        : []
      if (sameTag.length > 1) suffix = `:nth-of-type(${sameTag.indexOf(cursor) + 1})`
    }

    parts.unshift(
      `${cursor.localName}${cursor.id === '' ? '' : `#${cursor.id}`}${classes}${suffix}`,
    )
  }

  return parts.join(' > ')
}

// ---------------------------------------------------------------------------------------
// Svelte metadata
// ---------------------------------------------------------------------------------------

function nearestElement(node: Node | null): Element | null {
  if (node === null) return null
  if (node.nodeType === 1) return node as Element
  return node.parentElement
}

function nearestMeta(element: Element): SvelteMeta | null {
  for (let cursor: Element | null = element; cursor !== null; cursor = cursor.parentElement) {
    const meta = (cursor as Element & { __svelte_meta?: SvelteMeta }).__svelte_meta
    if (meta?.loc) return meta
  }
  return null
}

/**
 * The compiler's location, reported as **enclosing** until it can be verified against the file
 * (`docs/specs/location-resolution.md`): Svelte assigns locations positionally, so a recorded
 * line may belong to an ancestor. Verification arrives with the source window (M4); guessing
 * "verified" here would put a confident wrong line in a prompt.
 */
function sourceOf(meta: SvelteMeta | null): SourceLocation | null {
  if (!meta?.loc) return null

  return {
    file: meta.loc.file ?? null,
    line: meta.loc.line ?? null,
    column: meta.loc.column ?? null,
    enclosing: meta.loc.line != null,
  }
}

function templateOf(meta: SvelteMeta | null, element: Element): TemplateFrame[] {
  const frames: TemplateFrame[] = []

  // Svelte's dev stack is the source of truth; the mirrored one covers elements it did not
  // see (a branch rendered from an effect after init).
  for (
    let frame: DevFrame | FrameLike | null = meta?.parent ?? access.frameOf(element);
    frame !== null && frames.length < LIMITS.chainDepth;
    frame = frame.parent
  ) {
    const file = frame.file ?? null
    if (file !== null && file.includes('node_modules')) continue

    frames.push({
      type: frame.type,
      file,
      line: Number.isFinite(frame.line) ? frame.line : null,
      column: Number.isFinite(frame.column) ? frame.column : null,
      componentTag: frame.type === 'component' ? (frame.componentTag ?? null) : null,
    })
  }

  return frames
}

// ---------------------------------------------------------------------------------------
// Component chain
// ---------------------------------------------------------------------------------------

function chainOf(
  instance: InstanceLike | null,
  budget: ReturnType<typeof createBudget>,
): ComponentInfo[] {
  const chain: ComponentInfo[] = []

  for (
    let cursor: InstanceLike | null = instance;
    cursor !== null && chain.length < LIMITS.chainDepth;
    cursor = cursor.parent
  ) {
    chain.push(componentOf(cursor, budget))
  }

  return chain
}

function componentOf(
  instance: InstanceLike,
  budget: ReturnType<typeof createBudget>,
): ComponentInfo {
  return {
    id: instance.id,
    name: componentName(instance),
    file: instance.file ?? '',
    usage: instance.usage
      ? {
          file: instance.usage.file ?? null,
          line: instance.usage.line ?? null,
          column: instance.usage.column ?? null,
          componentTag: instance.usage.componentTag ?? null,
        }
      : null,
    props: instance.props ? cloneToJson(instance.props, budget) : null,
    state: stateOf(instance, budget),
    // Re-renders need `template_effect` to be wrapped; until then, an honest zero.
    renders: 0,
  }
}

function componentName(instance: InstanceLike): string {
  const file = instance.file ?? ''
  const base = file.slice(file.lastIndexOf('/') + 1).replace(/\.svelte$/, '')
  if (base !== '') return base
  return instance.name === '' ? '<anonymous>' : instance.name
}

function stateOf(instance: InstanceLike, budget: ReturnType<typeof createBudget>): StateNode[] {
  const nodes: StateNode[] = []

  for (const entry of instance.state.values()) {
    if (nodes.length >= LIMITS.stateNodes) break
    nodes.push({
      name: entry.name,
      type: stateType(entry),
      value: stateValue(entry, budget),
    })
  }

  return nodes
}

function stateType(entry: StateLike): StateNode['type'] {
  if (entry.kind === 'value') return 'state'
  const source = entry.source as { fn?: unknown } | null
  return typeof source?.fn === 'function' ? 'derived' : 'state'
}

/**
 * A signal's value lives in `.v`; a lazy `$derived` still holds `UNINITIALIZED` (a symbol), and
 * reporting a bogus value would be worse than saying nothing was read yet.
 */
function stateValue(entry: StateLike, budget: ReturnType<typeof createBudget>): string {
  const value = entry.kind === 'signal' ? (entry.source as { v?: unknown } | null)?.v : entry.source

  if (typeof value === 'symbol') return JSON.stringify(NOT_EVALUATED)

  return cloneToJson(value, budget)
}

// ---------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------

export function pageInfo(): PageInfo {
  if (typeof window === 'undefined') {
    return { url: '', path: '', title: '', viewport: '' }
  }

  return {
    url: window.location.href,
    path: window.location.pathname,
    title: typeof document === 'undefined' ? '' : document.title,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
  }
}

function empty(page: PageInfo): Inspected {
  return { page, element: null, source: null, template: [], components: [] }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

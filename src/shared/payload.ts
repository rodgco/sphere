/**
 * The `__SPHERE__` contract — the only types both sides share.
 *
 * `docs/specs/payload-schema.md` is the normative description; this file is the same thing in
 * TypeScript so the runtime and (from M2) the overlay cannot drift. Values that cross the
 * boundary are bounded clones serialised as **valid JSON text**, never sliced strings.
 */

export interface Inspected {
  /** Present unless the inspection failed. */
  error?: string
  page: PageInfo
  element: ElementInfo | null
  source: SourceLocation | null
  /** Svelte's dev stack: component tags and blocks the element sits in. */
  template: TemplateFrame[]
  /** Component instances that produced the element, innermost first. */
  components: ComponentInfo[]
}

export interface Located {
  source: SourceLocation | null
  component: ChainSummary | null
}

export interface PageInfo {
  /** Absolute, e.g. `http://localhost:3000/dashboard`. */
  url: string
  /** `/dashboard`. */
  path: string
  title: string
  /** `1440×900`, CSS pixels. */
  viewport: string
}

export interface ElementInfo {
  /** Lowercase, for display. */
  tag: string
  /** Raw, for matching; SVG keeps camelCase (`foreignObject`). */
  tagName: string
  id: string
  /** Authored only — Svelte's `svelte-xxxx` scopes are dropped. */
  classes: string[]
  /** ≤ 24 entries, values ≤ 120 chars. `class`/`style` live in `markup`, not here. */
  attrs: Record<string, string>
  /** Skeleton from tags and attributes, no text nodes, ≤ 600 chars. */
  markup: string
  /** `144×40`, rounded CSS pixels. */
  size: string
  /** Readable path for the panel, ≤ 6 levels. */
  selector: string
  /** Path for the prompt: same, with `:nth-of-type(n)` where siblings share the tag. */
  domPath: string
}

export interface SourceLocation {
  /** As reported by Svelte: absolute or root-relative. */
  file: string | null
  line: number | null
  column: number | null
  /** True when Svelte only recorded an ancestor for this element. */
  enclosing?: boolean
}

export interface TemplateFrame {
  /** `component | if | each | await | key | render | snippet | boundary`. */
  type: string
  file: string | null
  line: number | null
  column: number | null
  /** Only for `type === 'component'`. */
  componentTag: string | null
}

export interface ComponentInfo {
  id: number
  /** File basename without `.svelte`. */
  name: string
  file: string
  usage: {
    file: string | null
    line: number | null
    column: number | null
    componentTag: string | null
  } | null
  /** JSON text (bounded clone), or `null` when unknown. */
  props: string | null
  state: StateNode[]
  /** Re-renders after mount; `0` until template effects are wrapped. */
  renders: number
}

export interface StateNode {
  name: string
  type: 'state' | 'derived' | 'template' | 'effect' | 'effect_pre'
  /** JSON text (bounded clone), always parseable. */
  value: string
}

export interface ChainSummary {
  /** Innermost instance name, for the hover tooltip. */
  name: string
  file: string | null
  /** How many instances are above it, the instance itself included. */
  depth: number
}

export interface SphereApi {
  version: string
  inspectElement(node: Node | null): Inspected
  locateElement(node: Node | null): Located
}

declare global {
  interface Window {
    __SPHERE__?: SphereApi
  }
}

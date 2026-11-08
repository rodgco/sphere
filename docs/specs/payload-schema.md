# Spec — payload schema

The runtime's public surface (consumed by the overlay, and testable from the page):

```ts
window.__SPHERE__: {
  version: string
  inspectElement(node: Node | null): Inspected
  locateElement(node: Node | null): { source: SourceLocation | null; component: ChainSummary | null }
}
```

`inspectElement` never throws; failures come back as `{ error }`. Types below are the contract —
they live in `src/shared/payload.ts` and are imported by both sides.

```ts
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

export interface PageInfo {
  url: string        // absolute, e.g. http://localhost:3000/dashboard
  path: string       // /dashboard
  title: string
  viewport: string   // "1440×900"
}

export interface ElementInfo {
  tag: string              // lowercase, display
  tagName: string          // raw, matching (SVG camelCase)
  id: string
  classes: string[]        // authored only (no svelte-xxxx)
  attrs: Record<string, string>   // ≤ 24 entries, values ≤ 120 chars
  markup: string           // skeleton, ≤ 600 chars, no text nodes
  size: string             // "144×40" (rounded CSS pixels)
  selector: string         // readable path, ≤ 6 levels
}

export interface SourceLocation {
  file: string | null      // as reported by Svelte (absolute or root-relative)
  line: number | null
  column: number | null
  /** True when Svelte only recorded an ancestor for this element. */
  enclosing?: boolean
}

export interface TemplateFrame {
  type: string             // component | if | each | await | key | render | snippet | boundary
  file: string | null
  line: number | null
  column: number | null
  componentTag: string | null   // only for type === 'component'
}

export interface ComponentInfo {
  id: number
  name: string             // file basename without .svelte
  file: string
  usage: {
    file: string | null
    line: number | null
    column: number | null
    componentTag: string | null
  } | null                 // null for the root instance
  props: string | null     // JSON text (bounded clone) or null when unknown
  state: StateNode[]
  renders: number          // re-renders after mount
}

export interface StateNode {
  name: string
  type: 'state' | 'derived' | 'template' | 'effect' | 'effect_pre'
  value: string            // JSON text (bounded clone); always parseable
}
```

## Invariants (tested)

1. `JSON.parse(component.props)` and `JSON.parse(node.value)` succeed for every value the
   runtime produces — the runtime bounds a *clone*, it never slices serialised text.
2. `element.markup` contains no text nodes, no `svelte-` prefixed class and no `[object Object]`.
3. `source === null` or `source.file !== null`.
4. `components` is ordered innermost-first and every `usage.file`, when present, is a project
   file (or `null` for the root).
5. Values respect the budgets in `docs/03-instrumentation.md` §5 (shared across the whole
   inspection).
6. No absolute machine path appears in `element.markup`, `element.attrs` or `template`
   (paths are relativised by the formatter, not by the runtime).

## Example (abridged, from a real app)

```json
{
  "page": { "url": "http://localhost:3000/dashboard", "path": "/dashboard", "title": "Home · App", "viewport": "1269×919" },
  "element": {
    "tag": "div",
    "tagName": "div",
    "id": "",
    "classes": ["connection-pill"],
    "attrs": { "aria-live": "polite", "title": "Live status of the service" },
    "markup": "<div class=\"connection-pill\" aria-live=\"polite\"></div>",
    "size": "219×37",
    "selector": "aside.sidebar > div#sidebar-menu > div.sidebar-bottom > div.connection-pill"
  },
  "source": { "file": "src/lib/components/SystemStatus.svelte", "line": 41, "column": 0, "enclosing": false },
  "template": [
    { "type": "component", "file": "src/lib/components/AppSidebar.svelte", "line": 177, "column": 6, "componentTag": "SystemStatus" },
    { "type": "component", "file": "src/routes/dashboard/+page.svelte", "line": 44, "column": 2, "componentTag": "AppSidebar" }
  ],
  "components": [
    {
      "id": 12,
      "name": "SystemStatus",
      "file": "/home/me/app/src/lib/components/SystemStatus.svelte",
      "usage": { "file": "src/lib/components/AppSidebar.svelte", "line": 177, "column": 6, "componentTag": "SystemStatus" },
      "props": "{}",
      "state": [
        { "name": "health", "type": "state", "value": "{\"status\":\"ok\",\"service\":\"web\",\"database\":\"ok\",\"uptimeSeconds\":1234,\"latencyMs\":12}" },
        { "name": "error", "type": "state", "value": "null" },
        { "name": "tone", "type": "derived", "value": "\"ok\"" }
      ],
      "renders": 1
    }
  ]
}
```

Note the mixing of absolute and root-relative `file` values: Svelte reports what the compiler
was given. The formatter relativises both against the project root, which is why the copied
prompt never contains the absolute path (`docs/05-prompt-format.md` §2).

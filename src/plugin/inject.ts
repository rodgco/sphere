import { idToUrl, withBase } from './virtual.js'

/**
 * Where the page gets Sphere's browser code from.
 *
 * SvelteKit does not run `transformIndexHtml` (docs/learning/sveltekit-vite-dev-server.md §1), so
 * the tag is inserted into the generated server module's `templates.app` string literal instead —
 * or, for plain Vite apps, returned as a tag from `transformIndexHtml`.
 */
/**
 * No `\0` prefix: SvelteKit's dev middleware does not unwrap `__x00__` in `/@id/` URLs (it
 * answers its own 404 page), so the id must be one it can resolve. Vite resolves any specifier a
 * plugin claims, and `/@id/virtual:sphere/overlay` works in both plain Vite and Kit.
 */
export const OVERLAY_ID = 'virtual:sphere/overlay'

/** Also resolvable, for tests and for anyone who wants the runtime without the UI. */
export const RUNTIME_ID = 'virtual:sphere/runtime'

/** Ids of the two generated SvelteKit modules that carry the app template. */
export const KIT_TEMPLATE_FILE =
  /\.svelte-kit\/generated\/(?<file>server\/internal|dev\/server)\.js$/

export function isKitTemplateModule(id: string): boolean {
  return KIT_TEMPLATE_FILE.test(id.split('?')[0] ?? id)
}

/**
 * The script URL. `transformIndexHtml` tags are rewritten by Vite's dev HTML transform, which
 * prefixes `config.base`; a raw insertion into a Kit template must prefix it itself.
 */
export function injectionSrc(base: string, options: { absolute: boolean }): string {
  const url = idToUrl(OVERLAY_ID)
  return options.absolute ? withBase(url, base) : url
}

export function injectionTag(base: string, options: { absolute: boolean }): string {
  return `<script type="module" src="${injectionSrc(base, options)}"></script>`
}

export interface Injection {
  code: string
  /** False when the module already carried the tag, or its shape was not recognised. */
  injected: boolean
}

/**
 * Inserts `tag` before `</body>` inside the app template literal of a generated SvelteKit module.
 *
 * Three things make this fragile enough to be pure and tested separately:
 *
 * 1. The template is a **JS string literal**, so the tag's own quotes must be escaped once
 *    (`type=\"module\"`), or the emitted HTML loses them.
 * 2. The module is re-transformed on HMR, so the injection must be idempotent.
 * 3. The shape can change between Kit majors, so every step is verified and any doubt returns the
 *    code unchanged: a wrong insertion breaks the app's HTML, no insertion only loses the panel.
 */
export function injectIntoKitModule(code: string, tag: string): Injection {
  const escapedTag = escapeForStringLiteral(tag)
  if (code.includes(tag) || code.includes(escapedTag)) return { code, injected: false }

  const templates = code.indexOf('templates')
  if (templates === -1) return { code, injected: false }

  // `templates: { app: (...) => "…" }` in Kit 3, `templates.app = (...) => "…"` in Kit 2.
  const app = code.indexOf('app', templates)
  if (app === -1) return { code, injected: false }

  const literalStart = firstQuoteAfterAssignment(code, app)
  if (literalStart === -1) return { code, injected: false }

  const body = code.indexOf('</body>', literalStart)
  if (body === -1) return { code, injected: false }

  // Inside a string literal, not in code? The app template is usually a *concatenation*
  // (`"…" + head + "…"`), so track literal boundaries instead of assuming one literal.
  if (!insideStringLiteral(code, literalStart, body)) return { code, injected: false }

  return {
    code: `${code.slice(0, body)}${escapedTag}${code.slice(body)}`,
    injected: true,
  }
}

/** `"` becomes `\"` so the tag survives the template's own string literal. */
export function escapeForStringLiteral(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function firstQuoteAfterAssignment(code: string, from: number): number {
  const arrow = code.indexOf('=>', from)
  const equals = code.indexOf('=', from)
  const assignment = arrow === -1 ? equals : equals === -1 ? arrow : Math.min(arrow, equals)

  if (assignment === -1) return -1
  return code.indexOf('"', assignment)
}

/**
 * Whether `</body>` is part of the app template expression: inside a string literal, and not
 * past a statement boundary. A concatenated template (`"…" + head + "…"`) stays inside the
 * expression, while a later unrelated literal (`const body = "</body>"`) does not.
 */
function insideStringLiteral(code: string, start: number, end: number): boolean {
  const segment = code.slice(start, end)
  if (segment.includes(';') || segment.includes('${')) return false

  let inside = false

  for (let index = start; index < end; index += 1) {
    const character = code[index]
    if (character === '\\') {
      index += 1
      continue
    }
    if (character === '"') inside = !inside
  }

  return inside
}

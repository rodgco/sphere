/**
 * The public theme vocabulary (`docs/13-theming.md` §2).
 *
 * These are values, not a stylesheet: the overlay reads `--sphere-theme-*` custom properties and
 * nothing else crosses the shadow boundary. A theme can reference the page's own variables
 * (`var(--cds-background)`), which is how a design system is reused without importing it.
 *
 * Validation is shared: the plugin throws at server start, the overlay drops what does not fit.
 */

export const THEME_TOKENS = [
  'bg',
  'fg',
  'muted',
  'border',
  'raised',
  'accent',
  'on-accent',
  'danger',
  'picked',
  'on-picked',
  'hover',
  'shadow',
  'font',
  'mono',
  'radius',
  'radius-sm',
  'radius-input',
] as const

export type ThemeToken = (typeof THEME_TOKENS)[number]

export const THEME_MODES = ['auto', 'light', 'dark'] as const

export type ThemeMode = (typeof THEME_MODES)[number]

/** Values are CSS values; `var()` chains are the point of the feature. */
export type ThemeTokens = Partial<Record<ThemeToken, string>>

export interface ThemeOptions {
  mode?: ThemeMode
  tokens?: ThemeTokens
}

export interface ResolvedTheme {
  readonly mode: ThemeMode
  readonly tokens: ThemeTokens
}

/**
 * The hard cap on a value. Generous for a shadow or a font stack, small enough that a theme can
 * never become a payload (`docs/09-security-and-privacy.md` §5).
 */
export const MAX_THEME_VALUE = 200

const TOKEN_SET: ReadonlySet<string> = new Set(THEME_TOKENS)

/**
 * A value must not contain declaration or markup punctuation, control characters, an escape that
 * could spell a function name, or a function that fetches. `url()` and `@import` are the network
 * rule; `expression()` is legacy and free to reject. Everything else is the CSS parser's job.
 */
const FORBIDDEN_CHARACTERS = /[;{}<>\\]/
const FORBIDDEN_FUNCTIONS = /(?:url|expression)\s*\(|@import/i

export function isThemeToken(name: string): name is ThemeToken {
  return TOKEN_SET.has(name)
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/** The custom property a token maps to. The only public names are `--sphere-theme-*`. */
export function themeProperty(token: ThemeToken): string {
  return `--sphere-theme-${token}`
}

/** `null` when the value is usable, otherwise the reason (used verbatim in the option error). */
export function themeValueError(value: unknown): string | null {
  if (typeof value !== 'string') return 'must be a string'

  const text = value.trim()
  if (text === '') return 'must not be empty'
  if (text.length > MAX_THEME_VALUE) return `must be at most ${MAX_THEME_VALUE} characters`
  if (hasControlCharacter(text) || FORBIDDEN_CHARACTERS.test(text)) {
    return 'must not contain control characters, ; { } < > or \\'
  }
  if (FORBIDDEN_FUNCTIONS.test(text)) return 'must not contain url(), expression() or @import'

  return null
}

export function isValidThemeValue(value: unknown): value is string {
  return themeValueError(value) === null
}

function hasControlCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }

  return false
}

/** A theme that changes nothing; used when the option is absent. */
export function defaultTheme(): ResolvedTheme {
  return { mode: 'auto', tokens: {} }
}

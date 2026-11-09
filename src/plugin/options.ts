import {
  defaultTheme,
  isThemeMode,
  isThemeToken,
  themeValueError,
  type ResolvedTheme,
  type ThemeOptions,
  type ThemeTokens,
} from '../shared/theme.js'

/**
 * Sphere options, normalised once at server start.
 *
 * `theme` is the design-system bridge (`docs/13-theming.md`): the built-in mode plus values for
 * the public `--sphere-theme-*` tokens. The remaining v1 surface (`maxSelections`, `include`,
 * `startPosition`, `matchAttributes`) still lands with the runtime; see
 * `docs/02-architecture.md` §Options.
 */
export interface SphereOptions {
  /** Master switch. Default: true when the plugin is in the array at all. */
  enabled?: boolean
  /** Keep the overlay and element location but do not wrap `svelte/internal/client`. */
  instrumentation?: boolean
  /** Design-system bridge: map the overlay's tokens to values or to the page's variables. */
  theme?: ThemeOptions
}

export interface ResolvedOptions {
  readonly enabled: boolean
  readonly instrumentation: boolean
  readonly theme: ResolvedTheme
}

const KNOWN_KEYS: ReadonlySet<string> = new Set(['enabled', 'instrumentation', 'theme'])
const KNOWN_THEME_KEYS: ReadonlySet<string> = new Set(['mode', 'tokens'])

/**
 * Validates and fills defaults. Throws a `TypeError` naming the offending option,
 * because this runs at dev-server start where failing loudly is cheap.
 */
export function resolveOptions(input: SphereOptions | undefined): ResolvedOptions {
  const options: unknown = input === undefined ? {} : input

  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('sphere: options must be an object')
  }

  for (const key of Object.keys(options)) {
    if (!KNOWN_KEYS.has(key)) throw new TypeError(`sphere: unknown option "${key}"`)
  }

  const { enabled = true, instrumentation = true, theme } = options as SphereOptions
  if (typeof enabled !== 'boolean') {
    throw new TypeError('sphere: option "enabled" must be a boolean')
  }
  if (typeof instrumentation !== 'boolean') {
    throw new TypeError('sphere: option "instrumentation" must be a boolean')
  }

  return { enabled, instrumentation, theme: resolveTheme(theme) }
}

/** Strict on purpose: a typo in a token or a mode is a config bug, not a runtime condition. */
function resolveTheme(input: ThemeOptions | undefined): ResolvedTheme {
  if (input === undefined) return defaultTheme()

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('sphere: option "theme" must be an object')
  }

  for (const key of Object.keys(input)) {
    if (!KNOWN_THEME_KEYS.has(key)) {
      throw new TypeError(`sphere: unknown theme option "${key}"`)
    }
  }

  const { mode = 'auto', tokens } = input as { mode?: unknown; tokens?: unknown }
  if (!isThemeMode(mode)) {
    throw new TypeError('sphere: option "theme.mode" must be "auto", "light" or "dark"')
  }

  return { mode, tokens: resolveTokens(tokens) }
}

function resolveTokens(input: unknown): ThemeTokens {
  if (input === undefined) return {}

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('sphere: option "theme.tokens" must be an object')
  }

  const tokens: ThemeTokens = {}

  for (const [token, value] of Object.entries(input)) {
    if (!isThemeToken(token)) {
      throw new TypeError(`sphere: unknown theme token "${token}" (see docs/13-theming.md)`)
    }

    const error = themeValueError(value)
    if (error !== null) {
      throw new TypeError(`sphere: theme token "${token}" ${error}`)
    }

    tokens[token] = (value as string).trim()
  }

  return tokens
}

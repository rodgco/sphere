import {
  isThemeToken,
  isValidThemeValue,
  themeProperty,
  type ResolvedTheme,
} from '../shared/theme.js'

/**
 * The theme bridge (`docs/13-theming.md`).
 *
 * The plugin already validated the config, but this module repeats the checks because it is the
 * last place before a value reaches the page: unknown tokens and unsafe values are dropped, never
 * written. The value goes through the CSSOM (`setProperty`), so the browser parses it and no
 * string is ever assembled into a `<style>` element.
 *
 * Inline style is deliberate: it wins over page CSS, which is the precedence the docs promise
 * (defaults < page variables < plugin option).
 */

/** The subset of `HTMLElement` used here, so the function is testable without a DOM. */
export interface ThemeTarget {
  dataset: { [name: string]: string | undefined }
  style: { setProperty(name: string, value: string): void }
}

export function applyTheme(target: ThemeTarget, theme: ResolvedTheme | undefined): void {
  // A stale `virtual:sphere/config` (an old dev server across an upgrade) must not take the
  // overlay down before it mounts; the built-in palette is a fine fallback.
  if (theme === undefined) return

  // `auto` leaves the attribute absent: the media query in the stylesheet decides.
  if (theme.mode === 'light' || theme.mode === 'dark') target.dataset.sphereMode = theme.mode
  else delete target.dataset.sphereMode

  for (const [token, value] of Object.entries(theme.tokens)) {
    if (!isThemeToken(token) || !isValidThemeValue(value)) continue
    target.style.setProperty(themeProperty(token), value.trim())
  }
}

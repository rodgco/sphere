import config from 'virtual:sphere/config'
import type { ResolvedTheme } from '../shared/theme.js'

/**
 * The project's root and base, as the dev server sees them (`docs/07-delivery.md` §4).
 *
 * They travel in a module rather than the page's HTML, because the absolute project path would
 * otherwise be readable in every page's markup. The overlay needs them for two things: reading
 * source files (`/@fs`, which needs the base) and printing paths relative to the project.
 * `theme` is the design-system bridge (`docs/13-theming.md` §4).
 */
export interface SphereConfig {
  root: string
  base: string
  /**
   * The dev server's working directory. Svelte's reported filenames are relative to it, which is
   * not necessarily `root` when the server is started from a parent directory; both the `/@fs`
   * read and the printed path need it (`docs/07-delivery.md` §5, `docs/learning/svelte-internals.md` §4).
   */
  cwd: string
  version: string
  theme: ResolvedTheme
}

export const sphereConfig: SphereConfig = config

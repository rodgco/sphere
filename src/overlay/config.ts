import config from 'virtual:sphere/config'

/**
 * The project's root and base, as the dev server sees them (`docs/07-delivery.md` §4).
 *
 * They travel in a module rather than the page's HTML, because the absolute project path would
 * otherwise be readable in every page's markup. The overlay needs them for two things: reading
 * source files (`/@fs`, which needs the base) and printing paths relative to the project.
 */
export interface SphereConfig {
  root: string
  base: string
  version: string
}

export const sphereConfig: SphereConfig = config

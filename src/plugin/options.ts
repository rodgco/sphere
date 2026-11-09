/**
 * Sphere options, normalised once at server start.
 *
 * M0 accepts the master switch and the instrumentation escape hatch. The rest of the v1 surface
 * (`maxSelections`, `include`, `startPosition`, `matchAttributes`) lands with the runtime in M1;
 * see `docs/02-architecture.md` §Options.
 */
export interface SphereOptions {
  /** Master switch. Default: true when the plugin is in the array at all. */
  enabled?: boolean
  /** Keep the overlay and element location but do not wrap `svelte/internal/client`. */
  instrumentation?: boolean
}

export interface ResolvedOptions {
  readonly enabled: boolean
  readonly instrumentation: boolean
}

const KNOWN_KEYS: ReadonlySet<string> = new Set(['enabled', 'instrumentation'])

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

  const { enabled = true, instrumentation = true } = options as SphereOptions
  if (typeof enabled !== 'boolean') {
    throw new TypeError('sphere: option "enabled" must be a boolean')
  }
  if (typeof instrumentation !== 'boolean') {
    throw new TypeError('sphere: option "instrumentation" must be a boolean')
  }

  return { enabled, instrumentation }
}

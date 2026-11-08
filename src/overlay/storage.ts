/**
 * The only two things the overlay persists (`docs/06-toolbar-ux.md` §10). Picks, instructions and
 * the prompt are session-only by design.
 *
 * Every read validates: `localStorage` is user-writable and survives deploys, so a stale or
 * hand-edited value must fall back to the default instead of throwing during mount.
 */

export const CONTROL_KEY = 'sphere:control'
export const OPTIONS_KEY = 'sphere:options'

export interface ControlPosition {
  x: number
  y: number
}

export interface OverlayOptions {
  state: boolean
  props: boolean
  source: boolean
  template: boolean
}

export const DEFAULT_OPTIONS: OverlayOptions = {
  state: true,
  props: true,
  source: true,
  template: true,
}

/** `undefined` when storage is blocked (private mode, sandboxed iframe). */
export function safeStorage(): Storage | undefined {
  try {
    const storage = globalThis.localStorage
    if (!storage) return undefined
    // Touching it can throw in Safari's private mode.
    const probe = '__sphere__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return undefined
  }
}

export function readControl(storage: Storage | undefined = safeStorage()): ControlPosition | null {
  const value = readJson(storage, CONTROL_KEY)
  if (value === null || typeof value !== 'object') return null

  const { x, y } = value as Partial<ControlPosition>
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null

  return { x, y }
}

export function writeControl(
  position: ControlPosition | null,
  storage: Storage | undefined = safeStorage(),
): void {
  writeJson(storage, CONTROL_KEY, position)
}

export function readOptions(storage: Storage | undefined = safeStorage()): OverlayOptions {
  const value = readJson(storage, OPTIONS_KEY)
  if (value === null || typeof value !== 'object') return { ...DEFAULT_OPTIONS }

  const options = value as Partial<OverlayOptions>

  return {
    state: typeof options.state === 'boolean' ? options.state : DEFAULT_OPTIONS.state,
    props: typeof options.props === 'boolean' ? options.props : DEFAULT_OPTIONS.props,
    source: typeof options.source === 'boolean' ? options.source : DEFAULT_OPTIONS.source,
    template: typeof options.template === 'boolean' ? options.template : DEFAULT_OPTIONS.template,
  }
}

export function writeOptions(
  options: OverlayOptions,
  storage: Storage | undefined = safeStorage(),
): void {
  writeJson(storage, OPTIONS_KEY, options)
}

function readJson(storage: Storage | undefined, key: string): unknown {
  if (!storage) return null

  try {
    const raw = storage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown): void {
  if (!storage) return

  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // A full quota must not break the overlay; the position simply will not persist.
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

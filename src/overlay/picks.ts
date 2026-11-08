/**
 * The pick list: a cap, a toggle (picking the same element unpicks it) and the label the panel
 * shows. Kept free of Svelte and of the DOM's APIs beyond reading attributes so it can be tested
 * without a browser.
 */

export const PICK_CAP = 10

export interface PickEntry {
  element: Element
  label: string
  where: string
}

export type ToggleResult<T> =
  | { picks: T[]; action: 'added' }
  | { picks: T[]; action: 'removed' }
  | { picks: T[]; action: 'capped' }

/** Svelte's scope class: `svelte-1a2b3c`. */
const SVELTE_HASH = /^svelte-[a-z0-9]+$/i

/**
 * Adds, removes, or refuses. Refusing is a state the panel reports ("At most 10 elements per
 * prompt."), not an error the caller has to catch.
 */
export function togglePick<T extends { element: Element }>(
  picks: readonly T[],
  entry: T,
  cap: number = PICK_CAP,
): ToggleResult<T> {
  const existing = picks.findIndex((pick) => pick.element === entry.element)
  if (existing !== -1) {
    return { picks: picks.filter((_, index) => index !== existing), action: 'removed' }
  }

  if (picks.length >= cap) return { picks: [...picks], action: 'capped' }

  return { picks: [...picks, entry], action: 'added' }
}

/** `tag#id.classes`, authored classes only. */
export function pickLabel(element: Element): string {
  const id = element.id === '' ? '' : `#${element.id}`
  const classes = [...element.classList]
    .filter((name) => !SVELTE_HASH.test(name))
    .map((name) => `.${name}`)
    .join('')

  return `${element.localName}${id}${classes}`
}

/** `file:line`, prefixed with `~` when the location is only the enclosing element. */
export function pickWhere(element: Element): string {
  const api = typeof window === 'undefined' ? undefined : window.__SPHERE__
  const source = api?.locateElement(element).source
  if (!source?.line) return ''

  const where = `${source.file ?? ''}:${source.line}`.replace(/^:/, '')
  return source.enclosing ? `~${where}` : where
}

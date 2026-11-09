import { REDACTED, isRedactedKey } from '../shared/redact.js'

/**
 * The bounds every inspection shares (`docs/03-instrumentation.md` §Budgets).
 *
 * One click is one inspection; a page can hold megabytes of state, and cloning it inside a
 * click handler is how a devtool becomes the reason the app stutters. The clone is bounded
 * **before** serialising, so the JSON that reaches the formatter is always valid and the
 * truncation is marked inside the value rather than by cutting the string.
 */

export const LIMITS = {
  /** Objects/arrays visited by one inspection. */
  clonedNodes: 2_000,
  /** Characters of serialised values, one inspection. */
  clonedChars: 20_000,
  /** Depth of a cloned value (`data.user.role` fits). */
  depth: 4,
  /** Entries kept per object/array. */
  entries: 25,
  /** Characters kept per string inside a value. */
  stringLength: 320,
  /** Instances in a component chain. */
  chainDepth: 32,
  /** Signals reported per instance. */
  stateNodes: 40,
  /** Attributes copied from an element. */
  attrs: 24,
  /** Characters kept per attribute value. */
  attrLength: 120,
  /** Characters in the markup skeleton. */
  markupLength: 600,
  /** Element nesting in the markup skeleton. */
  markupDepth: 3,
  /** Children shown per level in the markup skeleton. */
  markupChildren: 6,
  /** Ancestors in the readable selector. */
  selectorDepth: 6,
} as const

export interface CloneBudget {
  nodes: number
  chars: number
}

export function createBudget(): CloneBudget {
  return { nodes: LIMITS.clonedNodes, chars: LIMITS.clonedChars }
}

/** Marker for a value the clone refused to walk into. */
export const ELLIPSIS = '…'

/** What a lazy `$derived` reports before anything reads it (`UNINITIALIZED`). */
export const NOT_EVALUATED = '<not evaluated>'

/**
 * A JSON-safe clone of `value`, bounded by `budget`.
 *
 * - strings, numbers, booleans and `null` survive; `bigint` becomes a string, `NaN`/`Infinity`
 *   become strings too (JSON cannot hold them);
 * - functions, symbols and `undefined` are dropped from objects and become `null` in arrays;
 * - cycles and values past the depth limit become `'…'`;
 * - getters that throw are skipped, because props and state belong to the app.
 */
export function cloneValue(value: unknown, budget: CloneBudget = createBudget()): unknown {
  return cloneBounded(value, budget, 0, new WeakSet())
}

/** JSON text for the payload. Never throws, never returns invalid JSON. */
export function cloneToJson(value: unknown, budget: CloneBudget = createBudget()): string {
  const clone = cloneValue(value, budget)
  try {
    return JSON.stringify(clone) ?? 'null'
  } catch {
    return 'null'
  }
}

function cloneBounded(
  value: unknown,
  budget: CloneBudget,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null) return null

  switch (typeof value) {
    case 'string':
      return spend(budget, clip(value, LIMITS.stringLength))
    case 'number':
      return Number.isFinite(value) ? spend(budget, value) : spend(budget, String(value))
    case 'boolean':
      return spend(budget, value)
    case 'bigint':
      return spend(budget, `${value}n`)
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined
    default:
      break
  }

  if (depth >= LIMITS.depth || budget.nodes <= 0 || budget.chars <= 0) {
    return spend(budget, ELLIPSIS)
  }

  const object = value as object
  if (seen.has(object)) return spend(budget, ELLIPSIS)

  seen.add(object)
  budget.nodes -= 1

  try {
    return Array.isArray(object)
      ? cloneArray(object, budget, depth, seen)
      : cloneObject(object, budget, depth, seen)
  } finally {
    seen.delete(object)
  }
}

function cloneArray(
  value: readonly unknown[],
  budget: CloneBudget,
  depth: number,
  seen: WeakSet<object>,
): unknown[] {
  const out: unknown[] = []

  for (let index = 0; index < value.length && out.length < LIMITS.entries; index += 1) {
    if (budget.chars <= 0) break
    const item = cloneBounded(read(value, index), budget, depth + 1, seen)
    out.push(item === undefined ? null : item)
  }

  if (value.length > out.length) out.push(`${ELLIPSIS} ${value.length - out.length} more`)

  return out
}

function cloneObject(
  value: object,
  budget: CloneBudget,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value instanceof Date) return spend(budget, value.toISOString())

  const out: Record<string, unknown> = {}
  const keys = Object.keys(value)
  let kept = 0
  let ranOut = false

  for (const key of keys.slice(0, LIMITS.entries)) {
    if (budget.chars <= 0) {
      ranOut = true
      break
    }

    if (isRedactedKey(key)) {
      spend(budget, key)
      out[key] = spend(budget, REDACTED)
      kept += 1
      continue
    }

    const item = cloneBounded(read(value, key), budget, depth + 1, seen)
    if (item === undefined) continue
    spend(budget, key)
    out[key] = item
    kept += 1
  }

  // Only a *budget* cut is reported: a function or a throwing getter is not "left out".
  const remaining = keys.length - kept
  if (remaining > 0 && (ranOut || kept === LIMITS.entries)) {
    out[ELLIPSIS] = `${ELLIPSIS} ${remaining} more`
  }

  return out
}

/** Reads without letting an app getter break the inspection. */
function read(value: object, key: PropertyKey): unknown {
  try {
    return (value as Record<PropertyKey, unknown>)[key]
  } catch {
    return undefined
  }
}

/** Approximates the serialised size so the character budget is spent, not counted twice. */
function spend<T>(budget: CloneBudget, value: T): T {
  if (typeof value === 'string') budget.chars -= value.length
  else if (typeof value === 'number') budget.chars -= 8
  else budget.chars -= 4
  return value
}

/** Cuts at the limit and marks it inside the string, so the JSON stays valid. */
export function clip(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1)}${ELLIPSIS}`
}

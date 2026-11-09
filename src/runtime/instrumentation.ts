import { installInspector } from './inspect.js'

/**
 * The runtime half of the `svelte/internal/client` seam.
 *
 * This module is served as source and compiled by the host's Vite, then imported by
 * the generated client module, which also re-exports the wrappers returned here. It sees
 * the upstream namespace as an argument, so it needs no import of its own for Svelte
 * internals — and it is only ever in the graph when Sphere is enabled.
 *
 * Rules from docs/03-instrumentation.md §Rules: call through always, degrade instead of
 * guessing, and never let a Sphere bug break the app. Every wrapper here:
 *
 * 1. calls the original with the original `this` and arguments and returns its value;
 * 2. does its bookkeeping in a way that cannot throw (`try`/`catch` around lens only);
 * 3. keeps no strong reference to an instance after it is gone.
 */

/**
 * The upstream bindings this module replaces. This list is the contract with Svelte:
 * a test asserts each name exists in the installed `svelte/internal/client`
 * (`test/svelte-client.test.ts`), and the harness asserts the wrapper differs from
 * upstream on exactly these names.
 */
export const REQUIRED_EXPORTS = [
  'push',
  'pop',
  'add_svelte_meta',
  'add_locations',
  'tag',
  'tag_proxy',
  'component',
  'each',
  'if',
  'key',
] as const

export type UpstreamClient = Record<string, unknown>

/** `svelte/internal/client`'s `FILENAME` symbol, read from upstream at install time. */
type FileNameKey = symbol

/** Svelte's dev stack entry, mirrored because `dev_stack` is not exported. */
export interface Frame {
  readonly type: string
  readonly file: string | undefined
  readonly line: number
  readonly column: number
  readonly componentTag: string | undefined
  readonly parent: Frame | null
  /** The instance that was current when this frame was created. */
  readonly instance: Instance | null
}

/** A named `$state`/`$derived`/proxy, as exposed by `tag`/`tag_proxy`. */
export interface StateEntry {
  readonly name: string
  readonly kind: 'signal' | 'value'
  /** The signal object (`$state`, `$derived`) or the proxy value. */
  readonly source: unknown
}

export interface Instance {
  readonly id: number
  /** Component file from `fn[FILENAME]`, as reported by the compiler. */
  readonly file: string | undefined
  /** Component function name (`Child`), not the tag name (`<Child />`). */
  readonly name: string
  readonly parent: Instance | null
  /** The `component` frame in the parent: where this instance's tag is used. */
  readonly usage: Frame | null
  /** The `$$props` object `push` received; properties are getters, so reads are live. */
  readonly props: Record<string, unknown> | null
  readonly state: Map<string, StateEntry>
}

/** What the instrumentation writes on every located element. */
export interface Stamp {
  instanceId: number | null
  frame: Frame | null
}

type AnyFunction = (...args: unknown[]) => unknown

const STAMP_KEY = '__sphere'

/** Nodes visited by one `add_locations` call before giving up (docs/03 §Rules 4). */
const MAX_STAMP_NODES = 20_000

/**
 * Instances kept for lookup, oldest evicted first. Element stamps store ids, so a bound is
 * required: a long dev session mounts thousands of components and everything reachable from
 * an instance (props, signals, state proxies) would otherwise be retained forever.
 */
const MAX_INSTANCES = 5_000

const ELEMENT_NODE = 1
const DOCUMENT_FRAGMENT_NODE = 11

const instances = new Map<number, Instance>()

/** Contexts seen during a component's init, so later block renders can be attributed. */
const contextInstances = new WeakMap<object, Instance>()

/** The wrappers per upstream namespace, so a re-install returns the same functions. */
const overridesByUpstream = new WeakMap<object, Record<string, unknown>>()

const warned = new WeakSet<object>()

let nextId = 0
let current: Instance | null = null
let frame: Frame | null = null
let fileNameKey: FileNameKey | null = null
let installedOnce = false
let activeEffect: (() => { ctx?: unknown } | null | undefined) | null = null
let signalReader: ((source: unknown) => unknown) | null = null

/** Read a signal through Svelte's own `get`, which refreshes a dirty `$derived`. */
export function readSignal(source: unknown): unknown {
  if (signalReader !== null) {
    try {
      return signalReader(source)
    } catch {
      // A source that is not a signal falls back to the field Svelte keeps on it.
    }
  }
  return (source as { v?: unknown } | null)?.v
}

/**
 * The honest state of the seam, for `inspectElement` to report later: `false` means the
 * prompt will have no component chain, props or state, and nothing else is broken.
 */
export function isInstrumentationInstalled(): boolean {
  return installedOnce
}

/** The instance a stamp points at, or `null` when the element predates the wrapper. */
export function getInstance(id: number): Instance | null {
  return instances.get(id) ?? null
}

/**
 * The instance that rendered an element: the nearest ancestor carrying a stamp. Walks up
 * because Svelte only locates the elements its compiler tracks (`docs/04-element-inspection.md` §1).
 */
export function instanceOf(node: Node | null): Instance | null {
  let element: Element | null =
    node === null ? null : node.nodeType === ELEMENT_NODE ? (node as Element) : node.parentElement

  while (element) {
    const stamp = stampOf(element)
    if (stamp?.instanceId != null) return getInstance(stamp.instanceId)
    element = element.parentElement
  }

  return null
}

/** The mirrored dev frame an element was created under, if it was created under one. */
export function frameOf(node: Node | null): Frame | null {
  let element: Element | null =
    node === null ? null : node.nodeType === ELEMENT_NODE ? (node as Element) : node.parentElement

  while (element) {
    const stamp = stampOf(element)
    if (stamp?.frame) return stamp.frame
    element = element.parentElement
  }

  return null
}

/**
 * Validates the upstream surface and installs the wrappers.
 *
 * A missing export degrades to no component context, never to an exception: the app keeps
 * working, the prompt says what it could not observe.
 */
export function installInstrumentation(upstream: UpstreamClient): Record<string, unknown> {
  const previous = overridesByUpstream.get(upstream)
  if (previous) return previous

  const missing = REQUIRED_EXPORTS.filter((name) => typeof upstream[name] !== 'function')
  if (missing.length > 0) {
    if (!warned.has(upstream)) {
      warned.add(upstream)
      console.warn(
        `[sphere] unsupported svelte/internal/client: missing ${missing.join(', ')}. ` +
          'Instrumentation is off; the prompt will lack component context.',
      )
    }
    // Nothing to override, but the generated wrapper still exports these names locally and
    // they shadow the star export. Re-export upstream's own functions so a component that
    // imports `push`, `each`, … keeps working; only the instrumentation is lost.
    const passthrough: Record<string, unknown> = {}
    for (const name of REQUIRED_EXPORTS) passthrough[name] = upstream[name]
    overridesByUpstream.set(upstream, passthrough)
    return passthrough
  }

  // One Svelte client per page: the first upstream to install wins the symbols.
  fileNameKey ??= (upstream.FILENAME as FileNameKey | undefined) ?? null
  activeEffect = () => upstream.active_effect as { ctx?: unknown } | null | undefined
  signalReader =
    typeof upstream.get === 'function'
      ? (source: unknown) => (upstream.get as AnyFunction)(source)
      : null

  const overrides: Record<string, unknown> = {
    push: wrapPush(upstream),
    pop: wrapPop(upstream),
    add_svelte_meta: wrapAddSvelteMeta(upstream),
    add_locations: wrapAddLocations(upstream),
    tag: wrapTag(upstream),
    tag_proxy: wrapTagProxy(upstream),
    component: wrapBlockWithFunctions(upstream, 'component', 1),
    each: wrapEach(upstream),
    if: wrapBlockWithFunctions(upstream, 'if', 1),
    key: wrapBlockWithFunctions(upstream, 'key', 1),
  }

  overridesByUpstream.set(upstream, overrides)
  installedOnce = true
  return overrides
}

// ---------------------------------------------------------------------------------------
// Wrappers
// ---------------------------------------------------------------------------------------

function wrapPush(upstream: UpstreamClient): AnyFunction {
  const push = upstream.push as AnyFunction

  return function push_(props: unknown, runes?: unknown, fn?: unknown) {
    const parent = current
    const instance: Instance = {
      id: ++nextId,
      file: fileOf(fn),
      name: nameOf(fn),
      parent,
      usage: frame,
      props: (props as Record<string, unknown> | null) ?? null,
      state: new Map(),
    }

    instances.set(instance.id, instance)
    if (instances.size > MAX_INSTANCES) {
      const oldest = instances.keys().next().value
      if (oldest !== undefined) instances.delete(oldest)
    }
    current = instance

    try {
      return push.call(upstream, props, runes, fn)
    } catch (error) {
      // A component that fails to initialise never reaches `pop`.
      current = parent
      throw error
    }
  }
}

function wrapPop(upstream: UpstreamClient): AnyFunction {
  const pop = upstream.pop as AnyFunction

  return function pop_(component?: unknown) {
    try {
      return pop.call(upstream, component)
    } finally {
      current = current?.parent ?? null
    }
  }
}

function wrapAddSvelteMeta(upstream: UpstreamClient): AnyFunction {
  const addSvelteMeta = upstream.add_svelte_meta as AnyFunction

  return function add_svelte_meta_(
    callback: unknown,
    type: unknown,
    component: unknown,
    line: unknown,
    column: unknown,
    additional?: unknown,
  ) {
    const parent = frame
    const entry: Frame = {
      type: String(type),
      file: fileOf(component),
      line: Number(line),
      column: Number(column),
      componentTag: tagOf(additional),
      parent,
      instance: current,
    }

    frame = entry
    rememberContext(upstream, current)

    try {
      return addSvelteMeta.call(upstream, callback, type, component, line, column, additional)
    } finally {
      frame = parent
    }
  }
}

function wrapAddLocations(upstream: UpstreamClient): AnyFunction {
  const addLocations = upstream.add_locations as AnyFunction

  return function add_locations_(fn: unknown, filename: unknown, locations: unknown) {
    const locate = addLocations.call(upstream, fn, filename, locations) as AnyFunction
    const list = Array.isArray(locations) ? locations : []

    return function located(this: unknown, ...args: unknown[]) {
      const dom = locate.apply(this, args)
      try {
        stampTree(dom, list)
      } catch {
        // Stamping is best-effort; a broken walk must not stop the element from existing.
      }
      return dom
    }
  }
}

function wrapTag(upstream: UpstreamClient): AnyFunction {
  const tag = upstream.tag as AnyFunction

  return function tag_(source: unknown, label: unknown) {
    rememberState('signal', source, label)
    return tag.call(upstream, source, label)
  }
}

function wrapTagProxy(upstream: UpstreamClient): AnyFunction {
  const tagProxy = upstream.tag_proxy as AnyFunction

  return function tag_proxy_(value: unknown, label: unknown) {
    rememberState('value', value, label)
    return tagProxy.call(upstream, value, label)
  }
}

/**
 * `if`, `key` and `component` take a render callback (plus getters) that Svelte invokes
 * later, outside `push`/`pop`. Wrapping the callbacks restores the owning instance while
 * the block renders, which is what makes an element inside `{#if}` attributable
 * (`docs/learning/svelte-internals.md` §6).
 */
function wrapBlockWithFunctions(
  upstream: UpstreamClient,
  name: string,
  firstOwnedArg: number,
): AnyFunction {
  const block = upstream[name] as AnyFunction

  return function block_(...args: unknown[]) {
    const owner = current
    return block.call(
      upstream,
      ...args.map((arg, index) => (index >= firstOwnedArg ? owned(owner, arg) : arg)),
    )
  }
}

function wrapEach(upstream: UpstreamClient): AnyFunction {
  const each = upstream.each as AnyFunction

  return function each_(...args: unknown[]) {
    const owner = current
    // (node, flags, get_collection, get_key, render_fn, fallback_fn)
    const [node, flags, ...rest] = args
    return each.call(upstream, node, flags, ...rest.map((arg) => owned(owner, arg)))
  }
}

// ---------------------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------------------

function rememberState(kind: StateEntry['kind'], source: unknown, label: unknown): void {
  if (current === null || typeof label !== 'string') return
  current.state.set(label, { name: label, kind, source })
}

/**
 * Contexts are captured during init, when `active_effect.ctx` is the instance being
 * initialised; block effects created then carry the same ctx and can be resolved later.
 */
function rememberContext(upstream: UpstreamClient, instance: Instance | null): void {
  if (instance === null) return
  const ctx = upstream.active_effect ? (upstream.active_effect as { ctx?: unknown }).ctx : undefined
  if (ctx && typeof ctx === 'object') contextInstances.set(ctx, instance)
}

function stampTree(dom: unknown, locations: readonly unknown[]): void {
  if (locations.length === 0 || !isNode(dom)) return

  const owner = current ?? instanceFromEffect() ?? frame?.instance ?? null
  const stamp: Stamp = { instanceId: owner?.id ?? null, frame }

  let node: Node | null = dom.nodeType === DOCUMENT_FRAGMENT_NODE ? dom.firstChild : (dom as Node)
  let index = 0
  let budget = MAX_STAMP_NODES

  while (node !== null && index < locations.length && budget-- > 0) {
    if (node.nodeType === ELEMENT_NODE) {
      ;(node as Element & Record<string, unknown>)[STAMP_KEY] = stamp
      index++
    }
    node = node.nextSibling
  }
}

function stampOf(element: Element): Stamp | null {
  const stamp = (element as Element & Record<string, unknown>)[STAMP_KEY]
  return stamp && typeof stamp === 'object' ? (stamp as Stamp) : null
}

/**
 * Block effects are created during a component's init, so `create_effect` gave them that
 * component's context (`svelte/src/internal/client/reactivity/effects.js:104`). When a block
 * renders later, that context is how the element is still attributed to its component.
 */
function instanceFromEffect(): Instance | null {
  const ctx = activeEffect?.()?.ctx
  if (!ctx || typeof ctx !== 'object') return null
  return contextInstances.get(ctx) ?? null
}

function owned(owner: Instance | null, value: unknown): unknown {
  if (typeof value !== 'function') return value
  const fn = value as AnyFunction
  return (...args: unknown[]) => withInstance(owner, () => fn(...args))
}

function withInstance<T>(instance: Instance | null, fn: () => T): T {
  const previous = current
  current = instance
  try {
    return fn()
  } finally {
    current = previous
  }
}

function fileOf(component: unknown): string | undefined {
  if (fileNameKey === null) return undefined
  if (typeof component !== 'function' && (component === null || typeof component !== 'object')) {
    return undefined
  }
  const file = (component as Record<PropertyKey, unknown>)[fileNameKey]
  return typeof file === 'string' ? file : undefined
}

function nameOf(component: unknown): string {
  if (typeof component === 'function' && component.name) return component.name
  return '<anonymous>'
}

function tagOf(additional: unknown): string | undefined {
  if (additional === null || typeof additional !== 'object') return undefined
  const tag = (additional as { componentTag?: unknown }).componentTag
  return typeof tag === 'string' ? tag : undefined
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value
}

// The API exists exactly when Sphere is in the graph. With no stamps (an unsupported Svelte) it
// still answers with element identity and an honest null for the chain.
installInspector({ instanceOf, frameOf, readSignal })

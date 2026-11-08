/**
 * Picking: the event matrix in `docs/specs/event-matrix.md`, as code.
 *
 * Everything is captured on `document` (capture phase) and only while picking; leaving removes the
 * listeners, so an app that never enables Sphere keeps its normal event flow. The pick happens on
 * `pointerdown`, and the rest of the primary-button chain is swallowed so neither the app's handlers
 * nor SvelteKit's delegated navigation see it.
 */

export interface PickingHandlers {
  /** The overlay host: events inside it are ours and are never swallowed. */
  host: Element | null
  onHover(target: Element | null, clientX: number, clientY: number): void
  onPick(target: Element, clientX: number, clientY: number): void
  onLeave(): void
}

/** Compatibility events that share the primary button. */
const PRIMARY_EVENTS = ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click', 'dblclick']

export function startPicking(handlers: PickingHandlers): () => void {
  const stoppers: Array<() => void> = []

  const own = (event: Event) => isOwnEvent(event, handlers.host)

  const swallow = (event: Event) => {
    if (own(event)) return
    // Only the primary button is picked and swallowed; a right click must reach the app's menu.
    if (event instanceof MouseEvent || event instanceof PointerEvent) {
      if (event.button !== 0) return
    }
    kill(event)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (own(event) || event.button !== 0) return

    kill(event)
    const target = elementAt(event.target)
    if (target) handlers.onPick(target, event.clientX, event.clientY)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (own(event)) {
      handlers.onHover(null, event.clientX, event.clientY)
      return
    }
    handlers.onHover(elementAt(event.target), event.clientX, event.clientY)
  }

  // auxclick fires for the buttons the primary handlers ignore; nothing about it is a pick.
  const onAuxClick = (event: Event) => {
    if (own(event)) return
    kill(event)
  }

  const add = (type: string, listener: EventListener) => {
    document.addEventListener(type, listener, true)
    stoppers.push(() => document.removeEventListener(type, listener, true))
  }

  for (const type of PRIMARY_EVENTS) {
    add(type, type === 'pointerdown' ? (onPointerDown as EventListener) : swallow)
  }
  add('auxclick', onAuxClick)
  add('pointermove', onPointerMove as EventListener)

  return () => {
    for (const stop of stoppers.splice(0)) stop()
    handlers.onLeave()
  }
}

/** The app element under the pointer, never an overlay element. */
export function elementAt(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  return target
}

export function isOwnEvent(event: Event, host: Element | null): boolean {
  if (host === null) return false

  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (path.includes(host)) return true

  // Shadow events are retargeted to the host for listeners outside it; keep the fallback for
  // environments (and old browsers) where the path is empty.
  const target = event.target
  return target instanceof Node && (target === host || host.contains(target))
}

function kill(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

/**
 * Native listeners for the overlay's own controls.
 *
 * Svelte 5 delegates a fixed set of events (`click`, `pointerdown`, …) to a single handler that
 * walks `event.composedPath()`. That is fine in a browser, but it means the overlay's behaviour
 * cannot be asserted in the harness: happy-dom returns an empty path, so no delegated handler ever
 * runs (`docs/learning/vitest-svelte-harness.md` §6). Attaching the listeners ourselves keeps the
 * overlay testable and gives us the capture options the picking matrix needs.
 */

type Handler<T extends Event> = (event: T) => void

/** A `<button>`-style click action, usable as `use:press={handler}`. */
export const press = native('click')

/** The double-click counterpart, `use:dblpress={handler}`. */
export const dblpress = native('dblclick')

/** `use:onChange={handler}` for checkboxes, which Svelte would otherwise delegate. */
export const onChange = native('change')

/** `use:onInput={handler}` for the instruction box, for the same reason. */
export const onInput = native('input')

function native(type: string) {
  return (node: HTMLElement, handler: Handler<MouseEvent>) => {
    let current = handler

    const listener: EventListener = (event) => current(event as MouseEvent)
    node.addEventListener(type, listener)

    return {
      update(next: Handler<MouseEvent>) {
        current = next
      },
      destroy() {
        node.removeEventListener(type, listener)
      },
    }
  }
}

/**
 * Keeps the overlay's own interactions out of the app (`docs/06-toolbar-ux.md` §7). Capture on
 * `document` already ignores them (picking), but the app's own bubble listeners on `window` would
 * otherwise see every click on our buttons. Propagation only — defaults still happen, so typing,
 * selecting and the checkboxes work.
 */
export function shield(node: HTMLElement) {
  const types = ['pointerdown', 'mousedown', 'mouseup', 'click']

  for (const type of types) node.addEventListener(type, stopPropagation)

  return {
    destroy() {
      for (const type of types) node.removeEventListener(type, stopPropagation)
    },
  }
}

function stopPropagation(event: Event) {
  event.stopPropagation()
}

export function listen<T extends Event>(
  target: EventTarget,
  type: string,
  handler: Handler<T>,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, handler as EventListener, options)
  return () => target.removeEventListener(type, handler as EventListener, options)
}

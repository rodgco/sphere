/** The single node Sphere adds to the page (`docs/06-toolbar-ux.md` §7). */
export const HOST_ID = 'sphere-host'

/** Whether an element belongs to the overlay rather than to the app. */
export function isOverlayElement(element: Element): boolean {
  return element.id === HOST_ID || element.closest(`#${HOST_ID}`) !== null
}

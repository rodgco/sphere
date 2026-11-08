/**
 * One cursor for the whole page while picking (`docs/06-toolbar-ux.md` §2).
 *
 * Inline on `documentElement` on purpose: the overlay's stylesheet lives in a shadow root, so a
 * class on the app's DOM would not reach it. The previous value is restored, including `''`.
 */
export function lockCursor(cursor = 'crosshair'): () => void {
  const root = document.documentElement
  const previous = root.style.cursor
  root.style.cursor = cursor

  return () => {
    root.style.cursor = previous
  }
}

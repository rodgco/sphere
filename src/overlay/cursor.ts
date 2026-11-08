/**
 * One cursor for the whole page while picking (`docs/06-toolbar-ux.md` §2).
 *
 * An inline `cursor` on `documentElement` is not enough: links and buttons set their own
 * (`cursor: pointer` from the UA sheet or the app's CSS), so hovering a component showed its cursor
 * instead of the crosshair. A single stylesheet with `!important` is the only way to win over the
 * app without editing the app's rules element by element.
 *
 * It is a `<style>` element, not classes on the app's DOM: removing it restores every rule the app
 * had, with nothing left behind. Styles inside the overlay's shadow root are unaffected, so the
 * pill keeps its grab cursor.
 */
const STYLE_ID = 'sphere-picking-cursor'

export function lockCursor(cursor = 'crosshair'): () => void {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `html, body, body * { cursor: ${cursor} !important; }`

  document.head.append(style)

  return () => {
    style.remove()
  }
}

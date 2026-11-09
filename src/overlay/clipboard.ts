/**
 * Writing the prompt to the clipboard, with a fallback for contexts where the async API is
 * unavailable or denied (an insecure origin, a permission prompt the user dismissed).
 *
 * The legacy path is a textarea and `document.execCommand('copy')`: deprecated, but it is the only
 * thing that works in those contexts, and the status line reports the failure honestly when both
 * paths fail.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }

  return legacyCopy(text)
}

export function legacyCopy(text: string): boolean {
  const active = document.activeElement as HTMLElement | null
  const selection = document.getSelection()
  const ranges =
    selection === null
      ? []
      : Array.from({ length: selection.rangeCount }, (_, index) =>
          selection.getRangeAt(index).cloneRange(),
        )

  const area = document.createElement('textarea')
  try {
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'

    document.body.append(area)
    area.focus({ preventScroll: true })
    area.select()

    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
    // Copying a prompt must not move the developer's caret or focus in the app. A detached
    // range or a focus target that disappeared must not turn a successful copy into a throw.
    try {
      active?.focus({ preventScroll: true })
    } catch {
      // best-effort
    }
    try {
      if (selection !== null) {
        selection.removeAllRanges()
        for (const range of ranges) selection.addRange(range)
      }
    } catch {
      // best-effort
    }
  }
}

/** `5 255`, the way the status line reads (docs/06 §5). */
export function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

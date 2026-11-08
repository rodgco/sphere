import { mount, unmount, type Component } from 'svelte'

export interface Rendered {
  target: HTMLElement
  byTestId(id: string): HTMLElement
  text(): string
  destroy(): void
}

/**
 * Mounts a fixture into the document and returns the pieces the assertions need.
 *
 * Always destroy in `finally`: happy-dom keeps the document between tests in a file, and
 * a leaked tree makes "the element was found" assertions pass for the wrong reason.
 */
export function render(component: Component, props: Record<string, unknown> = {}): Rendered {
  const target = document.createElement('div')
  document.body.append(target)

  const app = mount(component, { target, props: props as never })

  return {
    target,
    byTestId(id) {
      const element = target.querySelector<HTMLElement>(`[data-testid="${id}"]`)
      if (!element) throw new Error(`fixture: no element with data-testid="${id}"`)
      return element
    },
    text() {
      return target.textContent ?? ''
    },
    destroy() {
      unmount(app)
      target.remove()
    },
  }
}

/** Svelte's dev-mode element metadata, the raw material for location resolution. */
export interface ElementMeta {
  parent?: unknown
  loc?: { file: string; line: number; column: number }
}

export function metaOf(element: Element): ElementMeta | undefined {
  return (element as Element & { __svelte_meta?: ElementMeta }).__svelte_meta
}

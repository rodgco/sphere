import { describe, expect, it } from 'vitest'
// The module installs `window.__SPHERE__`; nothing else is needed for element identity.
import '../../src/runtime/instrumentation.js'

const inspect = (node: Node) => window.__SPHERE__!.inspectElement(node)

function element(html: string): Element {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder.firstElementChild!
}

/**
 * docs/09-security-and-privacy.md §3: a token pasted into a data attribute is still a token, and a
 * password field's `value` attribute can carry the typed value after a submit.
 */
describe('secrets never reach the payload', () => {
  it('drops sensitive attribute names from both attrs and the markup skeleton', () => {
    const field = element(
      '<input id="api" type="text" value="keep" data-api-key="sk-live-123" data-token="t" aria-label="API key">',
    )

    const inspected = inspect(field)

    expect(inspected.element?.attrs).toEqual({
      id: 'api',
      type: 'text',
      value: 'keep',
      'aria-label': 'API key',
    })
    expect(inspected.element?.markup).not.toContain('sk-live-123')
    expect(inspected.element?.markup).not.toContain('data-token')

    field.parentElement?.remove()
  })

  it('drops the value of a password input, even as an attribute', () => {
    const password = element('<input type="password" value="hunter2" name="pw">')

    const inspected = inspect(password)

    expect(inspected.element?.attrs).not.toHaveProperty('value')
    expect(inspected.element?.attrs.name).toBe('pw')
    expect(JSON.stringify(inspected)).not.toContain('hunter2')

    password.parentElement?.remove()
  })

  it('keeps ordinary attributes untouched', () => {
    const link = element('<a href="/files" title="Open files" data-testid="open">x</a>')

    expect(inspect(link).element?.attrs).toEqual({
      href: '/files',
      title: 'Open files',
      'data-testid': 'open',
    })

    link.parentElement?.remove()
  })
})

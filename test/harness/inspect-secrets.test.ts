import { describe, expect, it } from 'vitest'
// The module installs the inspection API; nothing else is needed for element identity.
import '../../src/runtime/instrumentation.js'
import { inspectElement } from '../../src/runtime/inspect.js'
import Sensitive from '../../fixtures/harness/Sensitive.svelte'
import { render } from './lib.js'

const inspect = (node: Node) => inspectElement(node)

function element(html: string): Element {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder.firstElementChild!
}

/**
 * `docs/decisions/0010-prompt-data-policy.md`: form values, URL queries/credentials, sensitive
 * attribute names and PII-shaped prop/state keys must not reach the payload.
 */
describe('secrets never reach the payload', () => {
  it('drops sensitive names and every form value from attrs and the markup skeleton', () => {
    const field = element(
      '<input id="api" type="text" value="keep" data-api-key="sk-live-123" data-token="t" aria-label="API key">',
    )

    const inspected = inspect(field)

    expect(inspected.element?.attrs).toEqual({
      id: 'api',
      type: 'text',
      'aria-label': 'API key',
    })
    expect(inspected.element?.markup).not.toContain('sk-live-123')
    expect(inspected.element?.markup).not.toContain('data-token')
    expect(inspected.element?.markup).not.toContain('value="keep"')
    expect(JSON.stringify(inspected)).not.toContain('keep')

    field.parentElement?.remove()
  })

  it('drops a password value even when the type is not lowercase', () => {
    const password = element('<input type="PASSWORD" value="hunter2" name="pw">')

    const inspected = inspect(password)

    expect(inspected.element?.attrs).not.toHaveProperty('value')
    expect(inspected.element?.attrs.name).toBe('pw')
    expect(JSON.stringify(inspected)).not.toContain('hunter2')

    password.parentElement?.remove()
  })

  it('strips credentials, query and fragment from URL attributes', () => {
    const link = element(
      '<a href="https://user:pass@example.test/files?token=abc#top" title="Open files">x</a>',
    )

    const inspected = inspect(link)

    expect(inspected.element?.attrs.href).toBe('https://example.test/files')
    expect(inspected.element?.markup).not.toContain('token=abc')
    expect(inspected.element?.markup).not.toContain('user:pass')

    link.parentElement?.remove()
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

  it('redacts PII and credential props and named state', () => {
    const view = render(Sensitive, {
      email: 'r@example.test',
      apiToken: 'sk-live-123',
      name: 'Sensitive',
    })
    try {
      const inspected = inspect(view.byTestId('sensitive'))
      const component = inspected.components[0]!
      const props = JSON.parse(component.props ?? '{}') as Record<string, unknown>
      const state = Object.fromEntries(
        component.state.map((node) => [node.name, JSON.parse(node.value)]),
      )

      expect(props).toMatchObject({
        name: 'Sensitive',
        email: '<redacted>',
        apiToken: '<redacted>',
      })
      expect(state.form).toEqual({ password: '<redacted>', count: 1 })
      expect(JSON.stringify(inspected)).not.toContain('r@example.test')
      expect(JSON.stringify(inspected)).not.toContain('sk-live-123')
      expect(JSON.stringify(inspected)).not.toContain('hunter2')
    } finally {
      view.destroy()
    }
  })
})

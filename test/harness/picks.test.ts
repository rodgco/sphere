import { describe, expect, it } from 'vitest'
import { pickLabel, pickWhere } from '../../src/overlay/picks.js'

function make(html: string): Element {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content.firstElementChild as Element
}

describe('pickLabel', () => {
  it('is tag#id.classes with authored classes only', () => {
    expect(pickLabel(make('<button id="save" class="primary svelte-1a2b3c">x</button>'))).toBe(
      'button#save.primary',
    )
    expect(pickLabel(make('<a class="link">x</a>'))).toBe('a.link')
    expect(pickLabel(make('<p>x</p>'))).toBe('p')
  })
})

describe('pickWhere', () => {
  it('is empty when the element has no Svelte location', () => {
    expect(pickWhere(make('<p>x</p>'))).toBe('')
  })
})

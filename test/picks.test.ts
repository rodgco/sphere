import { describe, expect, it } from 'vitest'
import { PICK_CAP, togglePick } from '../src/overlay/picks.js'

interface FakePick {
  element: Element
  name: string
}

const element = (name: string): FakePick => ({ element: { localName: name } as Element, name })

describe('togglePick', () => {
  it('adds, then removes the same element', () => {
    const button = element('button')

    const added = togglePick([], button)
    expect(added.action).toBe('added')
    expect(added.picks).toHaveLength(1)

    const removed = togglePick(added.picks, button)
    expect(removed.action).toBe('removed')
    expect(removed.picks).toHaveLength(0)
  })

  it('keeps the order of picks: the panel numbers them', () => {
    const picks = togglePick(togglePick([], element('a')).picks, element('b')).picks
    expect(picks.map((pick) => pick.name)).toEqual(['a', 'b'])
  })

  it('refuses past the cap without losing the existing picks', () => {
    let picks: FakePick[] = []
    for (let index = 0; index < PICK_CAP; index += 1) {
      picks = togglePick(picks, element(`e${index}`)).picks
    }

    const result = togglePick(picks, element('one-too-many'))
    expect(result.action).toBe('capped')
    expect(result.picks).toHaveLength(PICK_CAP)
    expect(result.picks.at(-1)?.name).toBe(`e${PICK_CAP - 1}`)
  })
})

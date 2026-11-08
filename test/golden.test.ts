import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatPrompt } from '../src/runtime/format.js'

const fixture = JSON.parse(readFileSync('test/fixtures/inspection.json', 'utf8')) as {
  page: Parameters<typeof formatPrompt>[0]['page']
  instructions: string
  options: Parameters<typeof formatPrompt>[0]['options']
  version: string | null
  selections: Parameters<typeof formatPrompt>[0]['selections']
}

describe('the golden prompt', () => {
  it('matches test/golden/prompt.md byte for byte', () => {
    const prompt = formatPrompt({
      page: fixture.page,
      instructions: fixture.instructions,
      options: fixture.options,
      selections: fixture.selections,
      ...(fixture.version === null ? {} : { version: fixture.version }),
    })

    const expected = readFileSync('test/golden/prompt.md', 'utf8')

    expect(prompt.text).toBe(expected)
    // The document rules from docs/05 §1: LF endings, no trailing whitespace.
    expect(prompt.text).not.toMatch(/[ \t]+\n/)
    expect(prompt.text).not.toMatch(/\r/)
  })
})

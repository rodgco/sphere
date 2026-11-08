/**
 * Regenerates `test/golden/prompt.md` from `test/fixtures/inspection.json`.
 *
 * The prompt format is the product's voice; the golden file is how a change to it becomes visible
 * in review. `npm run golden` rewrites it, the test asserts byte equality, and CI fails on a diff
 * that was not committed.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { formatPrompt } from '../src/runtime/format.ts'

const fixture = JSON.parse(readFileSync('test/fixtures/inspection.json', 'utf8'))

const prompt = formatPrompt({
  page: fixture.page,
  instructions: fixture.instructions,
  options: fixture.options,
  selections: fixture.selections,
  ...(fixture.version === null ? {} : { version: fixture.version }),
})

writeFileSync('test/golden/prompt.md', prompt.text)
console.log(`golden: ${prompt.text.length} chars${prompt.truncated ? ' (truncated)' : ''}`)

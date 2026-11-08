/**
 * Regenerates the prompt examples in `docs/specs/clipboard-example.md` from
 * `test/fixtures/inspection.json`.
 *
 * The document is the specification a reader trusts; the examples must be real output, not a
 * hand-written approximation. CI runs this and fails if the committed document differs.
 *
 *   node --experimental-strip-types scripts/clipboard-example.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { formatSelection } from '../src/runtime/format.ts'

const DOC = 'docs/specs/clipboard-example.md'
const fixture = JSON.parse(readFileSync('test/fixtures/inspection.json', 'utf8'))

const blocks = fixture.selections.map((selection) => formatSelection(selection, fixture.options))

let document = readFileSync(DOC, 'utf8')

for (const [index, prompt] of blocks.entries()) {
  const marker = `sphere:example case-${String.fromCharCode(97 + index)}`
  const pattern = new RegExp(
    `(<!-- ${marker} -->\\n)\`\`\`\`md\\n[\\s\\S]*?\\n\`\`\`\`(\\n<!-- /${marker} -->)`,
  )

  if (!pattern.test(document)) throw new Error(`missing markers for ${marker}`)

  document = document.replace(pattern, `$1\`\`\`\`md\n${prompt.trimEnd()}\n\`\`\`\`$2`)
}

writeFileSync(DOC, document)
console.log(`clipboard example: ${blocks.length} cases regenerated`)

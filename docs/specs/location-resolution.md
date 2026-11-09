# Spec — location resolution

Inputs: the payload's `source` (what Svelte recorded), the element identity, and the file text
(read in the browser through `/@fs`, optionally). Output: the location the prompt reports, plus
the reason it reports it.

This is the trickiest rule in the project; it exists because Svelte's own location can be the
ancestor's, and a wrong line in a prompt is worse than an honest "approximate".

## Algorithm

```ts
function resolveElementSource(payload, file, root) {
  const recorded = payload.source                                  // may be null
  const path = recorded?.file ?? payload.components[0]?.file       // fall back to the chain
  if (!path) return null                                           // nothing to say

  const result = {
    file: path,
    line: recorded?.line ?? null,
    column: recorded?.column ?? null,
    compiledLine: recorded?.line ?? null,   // what Svelte said, kept for the note
    matched: null,
    enclosing: Boolean(recorded?.line),     // pessimistic until proven otherwise
  }

  if (!file || !payload.element) return result                     // no text to verify against
  const lines = file.text.split(/\r?\n/)

  if (result.line && lineOpensElement(lines[result.line - 1], payload.element)) {
    result.enclosing = false                                       // verified
    return result
  }

  const match = matchSourceLine(file.text, payload.element, result.line)
  if (match) {
    result.line = match.line
    result.column = null
    result.matched = match.basis                                   // e.g. 'class="button primary"'
    result.enclosing = false
    return result
  }

  if (result.enclosing) result.column = null                       // the column is the ancestor's
  return result
}
```

## Matching (`matchSourceLine`)

Candidates are tried in this order; the first with hits wins:

1. `class="<authored classes joined by space>"` — exact, including the closing quote, so
   `class="button"` does not match `class="button primary"`.
2. `id="<id>"`.
3. `<attr>="<value>"` for `href`, `type`, `name`, `aria-label`, `title`, `placeholder`, `value`,
   `src` — **only when the element has no authored classes**; with classes present, a shared
   `href` is not identity.

A hit requires the line to *open the element's tag* (`<tag` followed by space, `>`, `/` or end
of tag name), compared case-insensitively so SVG's `foreignObject` matches, and without
building a `RegExp` from page-derived text. The attribute match is exact: `data-id="x"` is not
`id="x"`, and `class="button primary"` is not `class="button"`. The tag may wrap across lines;
the block is joined up to the first unquoted `>`. Among several hits, the line closest to the
compiler's hint wins (elements repeat; proximity is the best available disambiguator).

`lineOpensElement` (the verification used before matching) requires the tag **and** an exact
authored class list, or — when the element has no classes — an exact identifying attribute.

## What the reader sees

The formatter emits one of the shapes below (see `docs/05-prompt-format.md`); the panel chip and
the hover tooltip use the same information, with `~` for the last two:

| Case | `matched` | `enclosing` | `- markup:` | note |
|---|---|---|---|---|
| Verified | `null` | `false` | `file:line:col` | — |
| Matched | `'class="…"'` | `false` | `file:line` | “line matched by …; Svelte recorded the enclosing element at …” |
| Enclosing | `null` | `true` | `file:line` | “… is the enclosing element Svelte recorded; the element's own line was not found” |
| No location | — | — | omitted | — |

## Why not “fix” Svelte's assignment instead

Reimplementing `assign_locations` in the wrapper is possible (we know the shape: walk siblings,
consume one location per element, honour hydration markers) but it duplicates compiler logic we
do not own, would silently disagree with Svelte after an update, and fixes nothing outside
Sphere. The conservative matcher is bounded, testable, and its failure mode is “approximate”
rather than “wrong”. If Svelte fixes the positional assignment upstream, the matcher simply
stops being needed (it is only consulted when verification fails).

## Test matrix (must all exist)

| Input | Expectation |
|---|---|
| Recorded line opens the element | used as-is, column kept, no note |
| Recorded line is an ancestor | matched line reported, note, `~`, column dropped |
| Element has authored classes, only `href` matches | no match → enclosing |
| Element has no classes, `href` matches | matched by `href` |
| Same element appears twice in the file | the occurrence closest to the hint |
| Tag prefix (`<a` vs `<aside>`) | no false match |
| CamelCase SVG tag in source | matches case-insensitively |
| Element absent from the file | enclosing |
| Classless element, same tag, no identifying attribute | enclosing |
| `data-id="x"` on the line, element id `x` | no match (exact attribute boundary) |
| Tag and class split across lines | verified on the opening line |
| Same markup inside `<script>` | not a candidate; the real line matches |
| No file text | recorded line, `enclosing` flag preserved, no note |
| `__svelte_meta` missing entirely | chain file + matched line, `~` |

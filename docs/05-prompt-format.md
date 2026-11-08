# 05 — Prompt format

The clipboard document. One markdown file, no front-matter, no HTML comments, LF line endings,
no trailing spaces. It must be readable by a human and unambiguous for a model.

## 1. Skeleton

```md
# UI context from the running app

Page: `<url>` (<title>)
Viewport: <w×h>
Collected with: sphere <version>            ← optional, only when enabled in options

## What I need

<instructions, verbatim; a placeholder sentence when empty>

## Selection

<block for selection 1>

---

<block for selection 2>
```

Rules:

- `Page:` is always present. The title is omitted when empty. `Viewport:` is always present.
- `## What I need` is always present. When the box is empty the line is
  `(no instructions added — describe the change here)` — never an empty section.
- Blocks are separated by a line with exactly `---`. Selection order is pick order.
- The document is capped at 60 000 characters; when truncated, the text ends with
  `\n\n(prompt truncated: <original length> chars)`.

## 2. A selection block

```md
### Selected element <tag>[#id][.class…]

- markup: `<file>:<line>[:<col>]`                     ← or omitted when unknown
- location note: <see §4>                             ← only for approximate locations
- DOM path: `<a > b > c:nth-of-type(2)>`
- size: <w×h>
- attributes: <name="value" …>                        ← up to 12, without class/style
```html
<markup skeleton>
```

Template context (innermost first):
- <what> at `<file>:<line>:<col>`

Component chain (innermost first):
1. <Name> — `<file>`[ — renders the markup]
  - rendered by `<file>:<line>:<col>`
  - renders: <n>
  - props: <name=value, …>
  - $state <name> = <value>
  - $derived <name> = <value>
2. …
```

Rules:

- Heading identity: `tag` + `#id` + authored classes; nothing else. **Never** the text the
  element renders.
- `- DOM path:` uses `:nth-of-type(n)` only when siblings share the tag; stops at 6 levels.
- `attributes:` keeps insertion order, drops `class`/`style` (already in the markup block) and
  skips long values (already truncated by the runtime).
- The markup fence is always `html`, even for SVG.
- `Template context` is omitted when empty, filtered to project files, at most 8 frames.
- `Component chain` is omitted when every instance is from `node_modules`; entries are numbered
  from 1 (the number matches the outline on the page and the panel chip).
- `renders:` only when > 0. `props:` only when known and the option is on.
- `$state`/`$derived` lines: one per node, in the runtime's order, `name = value`.
- An instance whose file is the element's source file is labelled `— defines the markup` when
  it is not the head; the head is labelled `— renders the markup` in that case.
- `Source of` section, when the option is on and the file was readable:

```md
Source of `<file>`:
```<lang>
 <numbered window, 24 lines max, '>' on the reported line>
```
```

`<lang>` is `svelte`/`ts`/`js`/`css`/`json` by extension, empty otherwise. The window is
`line ± 8`, clamped to the file; lines are right-aligned in a fixed width with ` | ` between
number and text.

## 3. Values

- Scalars inline: `false`, `"text"`, `123`, `null`.
- Objects: `{status: "ok", latencyMs: 12}` — keys unquoted only when they are identifiers.
- Arrays: `[1, 2, 3]`, `["a", "b"]`.
- Inline budget 240 chars per value, ≤ 6 entries, depth 2, strings ≤ 40 chars.
- Past the budget: `{id, name, …3 more}` / `[12 items]`.
- `props` is one line: `name=value, …`, `$$slots` dropped, ≤ 400 chars, then `…`.

## 4. Location notes (verbatim strings)

- Matched: `line matched by `<needle>`; Svelte recorded the enclosing element at `<file>:<line>``
- Enclosing: `` `<file>:<line>` is the enclosing element Svelte recorded; the element's own line was not found ``
- No location, chain available: no `- markup:` line at all.

## 5. Options and their effect

| Option | Off means |
|---|---|
| `state` | no `$state`/`$derived` lines |
| `props` | no `props:` line |
| `source` | no `Source of` block |
| `template` | no `Template context` block |

Identity, markup, DOM path, size, attributes and the component chain **file/usage/render**
lines are not optional: without them the prompt is guesswork.

## 6. Non-goals

- No JSON/YAML variants in v1 (a tool could parse the payload later via the MCP surface).
- No screenshots, no base64, no images.
- No absolute paths, no `node_modules` frames, no environment values.
- No markdown escapes: component names, file paths and attribute values are emitted inside
  backticks so that model and human read them literally.

## 7. Golden test

`test/golden/prompt.md` is the expected output for `test/fixtures/inspection.json` with two
selections and instructions. Any change to this file requires an explicit update of both the
fixture and this spec; the test asserts byte equality (`\n` endings, no trailing whitespace).

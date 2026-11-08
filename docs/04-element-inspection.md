# 04 — Element inspection

From a clicked DOM node to the payload the formatter consumes. The payload type is
`docs/specs/payload-schema.md`; the location algorithm is `docs/specs/location-resolution.md`.

## 1. Resolving the node

1. A pointer event can land on a text node, an SVG path or an element. Walk up to the nearest
   `Element`.
2. Walk up from there to the nearest element carrying `__svelte_meta`. Two things come from
   that walk:
   - `loc` — `{ file, line, column }` of the nearest located element;
   - `__sphere` — `{ instanceId, frame }`, the component instance and mirrored dev frame the
     element-stamp pass recorded (`docs/03-instrumentation.md` §What the wrappers do).
3. If no `__svelte_meta` exists anywhere (metadata lost, `{@html}`, a DOM node created outside
   Svelte), the payload keeps `source: null` and the component chain is empty; the toolbar
   reports "no Svelte source location" instead of pretending.

## 2. Element identity

```jsonc
{
  "tag": "a",                 // lowercase, for display
  "tagName": "a",             // raw, for matching (SVG keeps camelCase: foreignObject)
  "id": "save",
  "classes": ["button", "primary"],  // authored only, svelte-xxxx dropped
  "attrs": { "href": "/files", "aria-label": "Open" },
  "markup": "<a class=\"button primary\" href=\"/files\"></a>",
  "size": "144×40",
  "selector": "main > form > button#save.primary"
}
```

Rules:

- **No rendered text.** The text an app renders is page copy, not identity; it also made the
  panel scroll sideways and blew up the payload for containers. `markup` is a *skeleton* built
  from tags and attributes, depth-limited (3) and child-limited (6 per level), 600 chars max,
  truncated at a tag boundary.
- **No `svelte-xxxx` scopes**, neither in `classes`/`selector`/`markup` nor in the attributes
  shown for `class`.
- Attributes are capped (24 entries, 120 chars each). `class` and `style` are not copied into
  `attrs` at all: they are already in `markup`, and repeating the class list is what made the old
  payload half its size.

## 3. Source location (the honest-part)

Svelte assigns locations positionally while the DOM is being created — and during hydration it
walks the *existing* DOM, so a child component's markup can shift the mapping
(`docs/learning/svelte-internals.md` §3). Therefore:

- The compiler's line is used **as-is only if it verifies**: the line opens the element's tag
  and contains its authored class list (or, for classless elements, its identifying attribute).
  Until the source window exists (M4) there is nothing to verify against, so every recorded line
  is reported as `enclosing` — the pessimistic default in the algorithm below.
- Otherwise the element is searched in its file: tag on the line **and** an exact attribute —
  authored `class="a b"`, then `id`, then `href`/`type`/`name`/`aria-label`/`title`/
  `placeholder`/`value`/`src`. A bare attribute is only accepted when the element has no
  authored classes (otherwise every link with the same `href` would match).
- If nothing matches, the compiler's line is reported **as the enclosing element**, with a note
  and a `~` marker; its column is dropped because it belongs to the ancestor.
- Reporting rules, exactly:

| Situation | `- markup:` | note |
|---|---|---|
| Verified | `file:line:col` | none |
| Matched in file | `file:line` | `line matched by \`class="…"\`; Svelte recorded the enclosing element at \`file:line\`` |
| Enclosing only | `file:line` | `\`file:line\` is the enclosing element Svelte recorded; the element's own line was not found` |
| No location at all | omitted | the chain's file is still reported |

The panel chip shows the same location and prefixes `~` for the last two cases. The hover
tooltip does the same with the raw (unresolved) location, so what you see while hovering is
never a guess.

## 4. Component chain and template context

- **Template context** comes from `__svelte_meta.parent` (Svelte's dev stack): innermost first,
  each frame labelled (`<Child />`, `{#if}`, `{#each}`, `{@render}`, `<svelte:boundary>`), with
  `file:line:col`. Frames from `node_modules` are filtered.
- **Component chain** comes from the instance tree: the stamped instance, then its parents.
  Each entry carries `file`, the frame where its tag is used in the parent, render count, props
  and state.
- **Snippets**: markup written in `A` but rendered by `B` is attributed by Svelte to `B`. Sphere
  keeps the tree but labels `—— renders the markup` on the head and `—— defines the markup` on
  the instance whose file matches the element's source. (Rationale and the alternative we
  rejected are in `docs/decisions/0005-snippet-labelling.md`.)

## 5. Values

Props and state are serialised as a bounded clone, then formatted:

- `props` — `name=value, …`, `$$slots` dropped, ≤ 400 chars.
- state — one line per node, `$state`/`$derived` prefix, value inline while it fits.
- inline rendering: `{status: "ok", latencyMs: 12}` (keys unquoted unless JSON would quote
  them), arrays `[1, 2, 3, …]`, nested up to 2 levels, ≤ 6 entries, strings ≤ 40 chars;
- past a 240-char budget: structure only — `{id, name, …3 more}` or `[12 items]`;
- the JSON handed to the formatter is always **valid** (bounded clone + `JSON.stringify`), and
  truncation is marked with `…` inside the value, never by cutting the string.

## 6. What is deliberately not collected

- Rendered text, computed styles, bounding box beyond `size`, event listeners.
- Instances/frames from `node_modules` (SvelteKit internals); the information is in the payload
  only as far as it helps locate the element.
- Anything outside the project root: `/@fs` reads are constrained by Vite's allow list and the
  base path, and paths are reported repository-relative.

## 7. Failure behaviour

`inspectElement` never throws: every step is guarded, and a failure returns
`{ error }` which the overlay surfaces as a status message. The same applies to `locateElement`
(hover): a failure yields `{ source: null, component: null }`.

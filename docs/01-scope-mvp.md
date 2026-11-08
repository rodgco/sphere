# 01 — MVP scope

Everything below is v1. "MUST" is a release blocker, "SHOULD" is expected, "MAY" is optional.

## 1. Enablement

- **MUST** be opt-in: `svelteSphere({ /* options */ })` in `vite.config.ts` (or a documented
  `svelte.config.js` switch if we decide to follow `vite-plugin-svelte`'s convention — see
  `docs/decisions/0002-opt-in-instrumentation.md`).
- **MUST** be inert when absent: with no option, the plugin adds no request handler, no
  injected script, no wrapper. The served `svelte/internal/client` module is upstream's.
- **MUST** work in a plain Svelte + Vite app and in a SvelteKit app.
- **MUST NOT** be present in `vite build` output (asserted in CI by grepping `build/`).

## 2. The floating control

- **MUST** be a small button, always reachable, in a corner by default.
- **MUST** be draggable, with the position remembered across reloads; double-click resets it.
- **MUST NOT** register a global keyboard shortcut (browser conflicts are unavoidable; the
  prototype fought Chrome's tab-group binding).
- **MUST** expose its active state (`aria-pressed`) and be operable by keyboard
  (Enter/Space toggles picking).
- **SHOULD** show the number of picks next to it, which opens the panel.

## 3. Picking

- **MUST** enter a picking mode from the control; the page keeps working otherwise.
- **MUST** swallow the interaction while picking: no navigation, no submit, no focus, no
  drag, no context menu from the primary button; the full event matrix is in
  `docs/specs/event-matrix.md`.
- **MUST** show what is under the pointer before the click: an outline plus a tooltip with
  `element` and `file:line[:col]` (with `~` when the line is inherited, see §5).
- **MUST** keep every picked element outlined with its number while the panel is open, and
  keep those outlines aligned through scroll (including scrollable ancestors), resize and
  re-render.
- **MUST** treat a second click on a picked element as "unpick".
- **MUST** refuse a pick past the cap (default 10) with a visible message, not silently.
- **SHOULD** use one cursor for the whole page while picking (nothing should suggest that a
  link is clickable or an input editable).

## 4. The panel

- **MUST** list the picks (number, element identity, source location) and allow removing one.
- **MUST** contain a free-text instruction box, kept while the panel is opened/closed.
- **MUST** have option toggles for `$state`, props, source window and template context, with
  the choice remembered.
- **MUST** have **Copy prompt** and **Clear** (Clear resets the whole form, including the text).
- **MUST** be reachable from the control, closable, and never overflow the viewport (it opens
  on whichever side of the control has room and shrinks its height accordingly).
- **MUST** meet the accessibility baseline in `docs/06-toolbar-ux.md` §8.

## 5. What is collected per selection

- **MUST** identify the element by tag, id and *authored* classes (Svelte's `svelte-xxxx`
  scopes are dropped everywhere, including the DOM path).
- **MUST** include a bounded markup skeleton (tags + attributes + the shape of the first
  children), never the text the element renders.
- **MUST** report a source location as one of: *verified* (the line's markup matches the
  element), *matched* (found by tag + exact attribute in the file, with the note saying so),
  or *enclosing* (only the ancestor Svelte recorded was available — labelled, never silent).
- **MUST** include the template context (component tags and blocks, innermost first, project
  files only).
- **MUST** include the component instance chain (innermost first) with each instance's file,
  where its tag is used, render count, props and `$state`/`$derived` values.
- **MUST** bound every value (see `docs/04-element-inspection.md` §5) and summarise large
  ones structurally instead of dumping them.
- **MUST** filter `node_modules` frames out of the template context and the chain.

## 6. The clipboard document

- **MUST** be the exact shape described in `docs/05-prompt-format.md` (page, instructions,
  then one block per selection), with a golden test.
- **MUST** be written with `navigator.clipboard.writeText`, with a documented fallback for
  insecure contexts.
- **MUST NOT** contain absolute machine paths, tokens, or the text the element renders.
- **MUST** stay under a hard cap (60 000 characters) with an explicit truncation notice.

## 7. Degradations (must not crash)

| Situation | Expected behaviour |
|---|---|
| Component tracking disabled | The pick still works; the panel says state/chain is unavailable |
| Runtime not loaded on the page | Picking reports it in the panel instead of throwing |
| Element removed from the DOM after picking | Outline disappears; the entry stays with its recorded location |
| Clipboard permission denied | A visible error, and the payload stays available for a retry |
| Source file unreadable | Prompt omits the source window; everything else is kept |
| `base` set (`/app/`) | Everything works; `/@fs` reads go through the base |

## 8. Explicitly out of v1

- MCP server or any agent-facing protocol (candidate for v2, see roadmap).
- Sending the prompt anywhere (editor integration, chat, API).
- Vue/React adapters.
- A hosted component of any kind.
- Screenshots of the app as prompt attachments (the agent gets text and markup, not pixels).

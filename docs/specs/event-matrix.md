# Spec — event matrix (picking swallows the interaction)

While picking, the primary-button interaction must not reach the app. Everything else must
behave normally. This table is the contract; `docs/07` and the e2e suite enforce it.

## Captured on `document`, `{ capture: true }`, only while picking

| Event | Primary button | Other buttons | Notes |
|---|---|---|---|
| `pointerdown` | **swallowed**, then the pick runs | passed through | `preventDefault` + `stopPropagation` + `stopImmediatePropagation`; focus taken explicitly on our own control |
| `mousedown` / `mouseup` | swallowed | passed through | compatibility events that libraries listen to |
| `pointerup` | swallowed | passed through | a pick is decided on `pointerdown`, never on up |
| `click` | swallowed | passed through | **required**: SvelteKit navigates on a delegated `click`; blocking `pointerdown` alone is not enough |
| `auxclick` | swallowed | — | fires for middle/right clicks |
| `dblclick` | swallowed | passed through | our marks must not trigger app handlers |
| `contextmenu` | **passed through** | passed through | the app's menu must keep working; we only pick on the primary button |
| `keydown` | the picking keys are handled and swallowed (`w`/`s`/`a`/`d`, arrows, `Enter`, `Space`, `Backspace`, `c`, `Escape`) | — | other keys reach the page; `Alt`/`Ctrl`/`Cmd` combinations are never ours |
| `keydown` inside the panel or an app field | never treated as picking keys; the panel stops propagation of its own typing | — | typing in the instructions must not trigger app shortcuts or move the selection. `Escape` is the exception: it leaves picking from anywhere |
| `touchstart` / `touchend` | passed through | — | not swallowed in v1: blocking them breaks scrolling during picking; picking on touch is a documented limitation |
| `submit`, `input`, `change` | passed through (they cannot fire because `click` is blocked) | — | — |
| `dragstart` / `dragover` / `drop` | passed through | — | address later if reports appear |

## Rules

1. **`event.button === 0` only.** A right click while picking must open the app's context menu;
   the pointer helper must not treat it as a pick.
2. **Our own UI is never swallowed.** Events whose `composedPath()` contains the host element or
   the shadow root are ignored by the swallow handlers (the panel stays usable while picking).
3. **No listener when not picking.** Entering/leaving picking adds/removes the listeners; an
   app that never enables Sphere keeps its normal event flow.
4. **A pick is `pointerdown`, not `click`.** This makes picking instant and lets us prevent the
   whole chain; the `click` that follows must still be swallowed (rule 1 of the table).
5. **Handled keys are swallowed, not merely observed.** A key that moves the selection must also
   `preventDefault()` (Space scrolls, arrows scroll) and `stopPropagation()` (an app shortcut), or
   picking breaks the page it is inspecting.
6. **The page must remain usable after a pick.** Because picking continues after a pick, the
   user leaves picking explicitly (or by copying); the e2e test navigates right after leaving to
   prove the listeners are gone.

## What “swallowed” means in code

```ts
const swallow = (event: Event) => {
  if (event instanceof PointerEvent || event instanceof MouseEvent) {
    if (event.button !== 0) return
  }
  if (isOwnEvent(event)) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}
```

`isOwnEvent` checks `composedPath()` for the host and the shadow root; nothing else is filtered.

## Tests (see `docs/08-testing.md` §4)

| Case | Expectation |
|---|---|
| Pick a link while picking | URL unchanged, one pick recorded |
| Leave picking, click the same link | navigates |
| Right click while picking | context menu event reaches the app, no pick recorded |
| Click the panel while picking | panel reacts (e.g. **Clear** works), no pick recorded |
| Escape while picking | picking stops, panel closes, page interactions work again |
| Type in the instructions | characters appear, page shortcuts do not fire |

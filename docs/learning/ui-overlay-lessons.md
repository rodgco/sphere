# Building a dev overlay inside someone else's page — lessons

The overlay is a guest: it renders into a page it does not own, must not break it, and must not
lie about what it is doing. These are the traps we hit and the rules they produced.

## 1. Shadow DOM isolates styles, not inherited properties

`cursor`, `font`, `color`, `pointer-events`, `visibility` and friends are **inherited**. A host
with `pointer-events: none` (required so the host does not block the page) also disables every
child unless each interactive element opts back in:

```css
:host { all: initial; /* …tokens… */ }
.fab, .panel { pointer-events: auto; }
```

`:host { all: initial }` resets to *initial*, not to “inherit from the page” — which is what we
want (a neutral base), but it also means every token must be declared explicitly.

## 2. One cursor for the whole page while picking

The page's own cursors promise interactions that will not happen (pointer over links, caret over
inputs, resize arrows over handles). A single cursor for the document fixes it:

```html
<style>
  html.sphere-picking, html.sphere-picking * { cursor: crosshair !important; }
</style>
```

- Lives in the **light DOM** so it reaches elements the overlay never touches.
- Does not cross shadow roots, so the overlay's own controls keep their cursors.
- Removed with the class when picking stops; nothing lingers in the page.

## 3. Swallowing interactions is a chain, not a click

SvelteKit navigates from a delegated `click`; blocking `pointerdown` alone does not stop it.
Libraries also react to `pointerup`, `mousedown`/`mouseup` and `dblclick`. The full matrix lives in
`docs/specs/event-matrix.md`; the takeaways:

- capture phase, on `document`, only while picking, only for `button === 0`;
- ignore events whose `composedPath()` contains the host/shadow root (the overlay stays usable);
- never swallow `contextmenu` — the app's menu must keep working;
- a pick is decided on `pointerdown`, never on `click`.

## 4. `preventDefault()` on pointerdown kills focus

A `<button>` whose `pointerdown` default is prevented never receives focus, so Enter/Space do
nothing even though the element is a button. Fix: call `focus({ preventScroll: true })` yourself.
This was the actual cause of “the inspector is not keyboard operable”, not the missing click
handler alone.

## 5. Drag vs click

One gesture, two outcomes. Decide by movement (> 4 px), suppress the `click` that follows a drag,
and never toggle state from both `pointerup` and `click` — that double-toggles. Keep the state on
`aria-pressed` so the UI and the accessibility tree agree.

## 6. Marks must be clipped by scroll containers

`position: fixed` overlays are clipped by the viewport, not by `overflow: auto` ancestors. An
element scrolled out of a sidebar would still be outlined on top of unrelated content. Clip the
element's rect against every scrollable ancestor's rect (and hide when the intersection is empty).

Tracking updates: one `requestAnimationFrame`-throttled pass driven by `scroll` (capture),
`resize`, one `ResizeObserver` per picked element, and one `MutationObserver` on the body while
marks exist. Cheap because there are ≤ 10 marks.

## 7. Panel placement

A fixed panel in a corner will cover content. Two rules avoid most of the pain:

- open the panel only once there is something to show (the first pick), never merely because the
  button was pressed;
- choose the side with room: above the control when it sits in the lower half, below otherwise,
  aligned to the control's side, and clamp the panel's height so it never leaves the viewport.
  Re-ordering the DOM to switch sides blurs a focused textarea — only do it when the side changes.

## 8. Theme

`prefers-color-scheme` + CSS variables on the host is enough: two token sets, no JS. The page's
own theme is irrelevant (it may be light with a dark OS setting); the overlay follows the OS, like
the rest of the developer's tools.

## 9. Accessibility is a design input, not a cleanup

- glyph buttons need `aria-label` (`✕` is announced as “multiplication x” otherwise);
- the panel is a dialog with a name; focus moves in when it opens and returns to the control when
  it closes;
- the status line is `role="status" aria-live="polite"`;
- the toggle is a real button with `aria-pressed`; the count chip has `aria-expanded`;
- focus visibility must survive both themes.

## 10. Never write page data with `innerHTML`

Everything derived from the page (tag names, attribute values, file paths) goes through
`textContent`/`setAttribute`. The markup skeleton is presented as text in a code block, never
parsed as HTML. This is both an XSS rule and a correctness rule (Svelte's markup is not HTML-safe
in isolation).

## 11. Hostile page fixtures worth having

- a sticky header with a huge `z-index`;
- a full-screen canvas that captures pointer events;
- a `pointer-events: none` wrapper around the app;
- a scroll container with `overflow: hidden`;
- a page with a `<dialog>`/modal open;
- RTL layout (badge/panel alignment).

Each of these has broken a dev overlay before; each has an e2e case.

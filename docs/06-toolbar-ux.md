# 06 — Toolbar UX

The overlay is the only part users see. It must feel like a tool, not like a demo: quiet,
predictable, keyboard-reachable, and never in the way of the page it is inspecting.

## 1. The control

- A compact pill: a status dot, the label **Inspect**, and — when there are picks — a count
  chip (`2 picked`). Height 36 px; bottom-right by default, 18 px from the edges.
- **Drag** anywhere on the pill moves it; the position is stored in `localStorage` and clamped
  into the viewport on mount and resize
  (`sphere:control`) and restored on load. Double-click returns it to the default corner. An open
  panel travels with it (§4).
- Dragging must not toggle picking: the gesture is decided by movement (> 4 px), and the `click`
  that follows a drag is suppressed.
- The control is a real `<button>`: Enter/Space toggle picking, and `aria-pressed` reflects the
  state. Focus is taken explicitly on pointer press (browsers do not focus a button whose
  `pointerdown` default was prevented).
- No global keyboard shortcut in v1 (ADR 0003). The count chip opens/closes the panel and
  exposes `aria-expanded`.

## 2. Picking mode

- Entering: crosshair cursor for the whole page, one cursor everywhere; hovering outlines the
  element under the pointer and shows a tooltip `` `<tag>  <file>:<line>` `` (prefixed `~` when
  the location is approximate).
- Clicking **picks** the element (primary button only) and keeps picking, so several elements
  can be collected without re-entering the mode.
- **Keyboard selection**, for what the pointer cannot reach — a container that only wraps its
  children (a fill layer, an overlay, a grid cell) can never be clicked, because the children are on
  top. While picking, one key moves a keyboard cursor through the tree and outlines what it landed
  on:

  | Key | Action |
  |---|---|
  | `w`, `↑` | parent |
  | `s`, `↓` | first child |
  | `a`, `←` | previous sibling |
  | `d`, `→` | next sibling |
  | `Enter`, `Space` | pick / unpick the outlined element |
  | `Shift+Enter` | pick it and leave picking |
  | `p` | pin the outline, so a click confirms it wherever the pointer goes |
  | `Backspace` | remove the most recent pick |
  | `c` | copy the prompt (same as the button) |
  | `?` | show or hide the shortcut list |
  | `Escape` | close the shortcut list; otherwise close the panel and leave picking |

  The list is not folklore: `?` opens it inside the shadow root, and the panel header has a `?`
  button for the same dialog, so the keys are discoverable without reading the README.

  Keys work from the moment picking starts, before anything is picked: the cursor begins at the
  element the pointer last outlined (or, if it never entered the page, at the page's own content),
  and the outline appears and moves with every step. So "hover the child, `w`, click" and "hover the
  child, `w`, `Enter`" are both one gesture.

  A navigation key **locks** the selection: the pointer no longer moves the outline, so a click can
  confirm the outlined element even though the mouse had to travel to the click. The click picks
  what is outlined, then hands the selection back to the pointer. `p` locks the outline the pointer
  is already on, which is what to use when hovering itself changes the page (a menu that opens, a
  tooltip that appears): pin, move, click. `Enter` keeps the cursor where it is, so a parent and then
  its grandparent can be collected without re-navigating.

  Keys with `Alt`/`Ctrl`/`Cmd` are left to the app and the browser, and anything typed into the panel
  or an app field is typing, not navigation — only `Escape` works from inside a text field.
- Picking an already-picked element **unpicks** it.
- The interaction never reaches the page: the full matrix is `docs/specs/event-matrix.md`.
- Leaving: clicking the control again, pressing Escape (which also closes the panel), or
  starting a drag. Copying the prompt stops picking.
- The page keeps working normally when not picking: no listener is attached.

## 3. Marks (picked elements stay visible)

- Each pick gets a 2 px green outline with a numbered badge (1, 2, …) matching its panel entry.
- Marks follow the element through scroll (including scrollable ancestors), window resize,
  layout changes (ResizeObserver per element) and DOM mutations (throttled to one frame).
- A mark is clipped by every scrollable ancestor, not just the viewport; when the element is
  off-screen or removed, the mark hides and the entry stays.
- The hover outline steps aside for a picked element, and disappears immediately when a pick
  lands, so two boxes never stack.

## 4. Panel

- 420 px wide (never wider than `100vw - 36px`), max height `min(70vh, 620px)`, scrolls
  vertically only.
- Anchored to the control, never floating on its own: it sits `10 px` from the pill on the side
  facing it, moves with the pill during a drag, and re-chooses the side as the pill moves — above
  when the control is in the lower half, below otherwise — because that is the side with room.
  The edge facing the control is the pinned one (`bottom` when above, `top` when below), so a
  panel shorter than the room available keeps exactly that 10 px gap instead of leaving a hole.
  It is left/right aligned to the control's side, clamped by the 18 px viewport margin, and its
  height is clamped to the room on the chosen side (also `min(70vh, 620px)`), so it never leaves
  the viewport. Placement is pure state (`src/overlay/position.ts`), not a measurement taken when
  the panel opens, so the panel moves in the same frame as the pill.
- Sections, top to bottom: header (title, hint, close), picks list, instruction box, options,
  actions (Copy prompt, Clear, status).
- Picks list entries: `1. tag#id.classes`, the resolved location (with `~` when approximate),
  and a remove button. Removing renumbers badges.
- Instruction box: 3 rows by default, resizable, value preserved across open/close. **Clear**
  empties it (plus the picks) — the whole form.
- Options: `$state`, `props`, `source`, `template` checkboxes; persisted in
  `localStorage` (`sphere:options`).
- The empty state says what to do: "Click Inspect, then click an element in the page."

## 5. Feedback

- A short status line (`role="status"`, `aria-live="polite"`): "Added button", "Removed a",
  "Copied 5 255 chars", "At most 10 elements per prompt.", "Could not write to the clipboard."
- Errors are red (`aria-invalid`-free; colour is not the only signal — the text says it).
- The panel never blocks the app silently: any interaction on the panel is the panel's.

## 6. Theme

- Dark and light palettes follow `prefers-color-scheme` by default; `sphere({ theme: { mode } })`
  can force `light` or `dark` (`docs/13-theming.md` §5).
- The palette is a small, stable token vocabulary read from `--sphere-theme-*` custom properties,
  with built-in fallbacks. A project can map its design system's variables without importing its
  CSS; `sphere({ theme: { tokens } })` does the same from `vite.config.ts`
  (`docs/13-theming.md`, ADR 0012).
- Precedence is built-in defaults < page CSS inherited into the host < the plugin option.
- Marks and hover outlines default to green = picked and blue = hover in both modes; both are
  tokens (`picked`, `hover`) and are expected to stay recognisable in a mapped theme.

## 7. Isolation

- The overlay lives in a shadow root attached to a single host element
  (`#sphere-host`, `position: fixed; inset: 0; pointer-events: none; z-index: 2147483000`).
- Styles are scoped; the host sets `:host { all: initial }` and then declares everything it
  needs, including `pointer-events: auto` on interactive children (it is inherited, and the
  host's `none` must not leak into the panel).
- The only values that cross the shadow boundary from the page are the `--sphere-theme-*` custom
  properties listed in `docs/13-theming.md` §2. They are values, not rules: no page stylesheet,
  font, reset or class reaches the overlay, and a variable the vocabulary does not name is
  ignored. `--sphere-theme-*` is set on the host's inline style by the plugin option, so it also
  beats page CSS.
- The overlay must not use the app's CSS, fonts or classes, and must not add classes to the
  app's DOM (marks are drawn by the overlay, not by styling the element). The one exception is the
  crosshair cursor while picking: a single `<style>` element is appended to the page with
  `cursor: crosshair !important` and removed on leaving, because links and buttons set their own
  cursor and an inherited value would lose to them. Nothing is left behind, and the overlay's own
  styles (inside the shadow root) keep their cursor.

## 8. Accessibility baseline

- Every button has an accessible name (`aria-label` when the visual is a glyph).
- The panel is `role="dialog"` with `aria-label="Build a prompt"`, `tabindex="-1"`. Focus moves to
  the dialog when it opens from a pick (so it is announced) and returns to the control on
  Escape/close. The shortcut list is `role="dialog"` with `aria-label="Keyboard shortcuts"` and
  closes on Escape before anything else does. It deliberately does **not** jump into the instruction box: single-key picking (
  `w`, `a`, `s`, `d`) must keep working until the user chooses to type, and one Tab reaches the box.
- Focus ring: 2 px outline in both themes, never removed without a replacement.
- Everything reachable by keyboard: control (Enter/Space), panel (Tab), picks (remove buttons),
  options (checkboxes), actions (buttons), Escape to leave picking/close.
- Contrast: text ≥ 4.5:1 in both themes; marks/badges ≥ 3:1.
- Motion: no animation longer than 150 ms; respect `prefers-reduced-motion` if any is added.

## 9. Sizes and copy (source of truth)

| Element | Value |
|---|---|
| Control height | 36 px, radius 999 px, padding 0 12 px |
| Control font | 13 px, 600 for the label |
| Panel width / max-height | 420 px / `min(70vh, 620px)` |
| Panel radius / border | `--sphere-theme-radius` (14 px) / 1 px |
| Control radius | 999 px (pill; not a theme token) |
| Button/close radius | `--sphere-theme-radius-sm` (8 px) |
| Instruction box radius | `--sphere-theme-radius-input` (10 px) |
| Chip font | 12 px, mono for tag/location |
| Mark border / badge | 2 px solid #22c55e / 18 px pill, 11 px bold |
| Hover outline | 2 px solid #3b82f6, 14 % fill |
| Status messages | see §5 |

## 10. Persistence keys

| Key | Content |
|---|---|
| `sphere:control` | `{ x, y }` of the control (null when default); clamped into the viewport |
| `sphere:options` | `{ state, props, source, template }` |

Nothing else is stored. Picks, instructions and the prompt are session-only by design: closing
the tab clears them. The theme is configuration (`docs/13-theming.md`), not a stored UI preference.

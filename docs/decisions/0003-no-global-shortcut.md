# 0003 — No global keyboard shortcut; the control is draggable

## Context

The prototype's first version toggled picking with `Alt+Shift+P`. Chrome binds that combination to
“create a tab group” (via an extension in the author's profile), so the shortcut was captured by
the browser and the toolbar was effectively unreachable. Any global combination has this problem
somewhere: OS, browser, extensions, IDE and the app itself all compete.

## Decision

No global shortcut in v1. The control is a real button that is **draggable** anywhere, remembers its
position, and can be reset by double-click. It is keyboard-operable when focused (Enter/Space) and
announces its state with `aria-pressed`.

## Consequences

- Nothing can shadow or be shadowed by a browser binding.
- A user who drags the control to a corner it can be lost in has a recovery path (double-click).
- Discoverability depends on the control being visible: it must never be hidden behind the app's own
  chrome, and it must be small (36 px).
- If a shortcut is added later, it must be configurable, off by default, and documented with the
  combinations that are known to conflict.

## Alternatives considered

- **A configurable shortcut, default on**: still ships a conflict to every user; rejected.
- **`Alt+X`, like `vite-plugin-svelte`'s inspector**: proven to work in practice, but two overlays
  in one page would fight over it.

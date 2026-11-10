---
'sphere-plugin': patch
---

Keep the prompt panel attached to the control. It used to be placed once, when it opened, from an
estimated height: the panel then floated away from the pill (a visible hole where the estimate was
too large) and stayed behind when the pill was dragged. The panel is now pinned by the edge facing
the control (`bottom` when above, `top` when below), so a short panel keeps exactly the 10 px gap,
and its placement is derived from the control's live box, so it travels with a drag and re-chooses
its side as the pill approaches an edge. The panel width, height cap and 18 px viewport margin now
come from the same constants as the overlay's CSS (`docs/06-toolbar-ux.md` §4).

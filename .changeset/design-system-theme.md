---
'sphere-plugin': minor
---

Add a design-system bridge (`docs/13-theming.md`). The overlay now reads a small public token
vocabulary from `--sphere-theme-*` custom properties with built-in fallbacks, so a project can map
Carbon, Tailwind or its own variables into the tool without importing a framework, its CSS or its
components. `sphere({ theme: { tokens } })` applies the same mapping from `vite.config.ts` (inline
style on the host, so it wins over page CSS), and `theme.mode` (`auto`/`light`/`dark`) chooses the
built-in palette. Values are validated at server start and again before they reach the page; the
default look is unchanged when no theme is configured. Decision:
`docs/decisions/0012-design-system-tokens.md`.

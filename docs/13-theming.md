# 13 — Theming and design systems

The overlay looks the way it does because a tool should look like a tool, not like a demo. But a
developer may want it to match the site they are inspecting, or their own taste. This document is
the contract for doing that **without** adding a framework to Sphere.

The decision is in `docs/decisions/0012-design-system-tokens.md`. The short version: CSS custom
properties are the only bridge; no design-system CSS, classes, components or runtime ever enters
the overlay.

## 1. Goals and non-goals

**MUST** keep working with no configuration, byte-for-byte the same look as before this feature.

**MUST** let a project map its own design-system tokens into the overlay, with or without the
plugin option, and **MUST** follow live theme changes (no reload, no re-mount).

**MUST NOT** add a dependency, a CSS import, a build step or a class name from any design system.

**MUST NOT** let the page restyle the overlay beyond the declared token vocabulary, and **MUST NOT**
let the overlay change the page.

Out of scope: adopting a design system's components, loading its stylesheet, automatic detection
of the project's framework, and arbitrary CSS in the plugin option.

## 2. The token contract

The public variables are `--sphere-theme-<token>`. They are read by the overlay's shadow-root
stylesheet; the internal `--sphere-*` variables are private and may change. Every token has a
built-in fallback, so setting one is optional.

| Token | Variable | Light default | Dark default | Used by |
|---|---|---|---|---|
| `bg` | `--sphere-theme-bg` | `#ffffff` | `#111827` | control, panel, shortcut list |
| `fg` | `--sphere-theme-fg` | `#111827` | `#f9fafb` | all text |
| `muted` | `--sphere-theme-muted` | `#6b7280` | `#9ca3af` | hints, status, secondary text, idle dot |
| `border` | `--sphere-theme-border` | `#e5e7eb` | `#374151` | borders, separators |
| `raised` | `--sphere-theme-raised` | `#f9fafb` | `#1f2937` | inputs, chips, hover rows, `kbd` |
| `accent` | `--sphere-theme-accent` | `#2563eb` | `#60a5fa` | active dot, focus ring, primary button |
| `on-accent` | `--sphere-theme-on-accent` | `#ffffff` | `#ffffff` | text on the primary button |
| `danger` | `--sphere-theme-danger` | `#dc2626` | `#f87171` | error status |
| `picked` | `--sphere-theme-picked` | `#22c55e` | `#22c55e` | pick marks and badges |
| `on-picked` | `--sphere-theme-on-picked` | `#052e16` | `#052e16` | badge text |
| `hover` | `--sphere-theme-hover` | `#3b82f6` | `#3b82f6` | hover outline and its fill |
| `shadow` | `--sphere-theme-shadow` | `0 12px 32px rgba(15, 23, 42, 0.18)` | `0 12px 32px rgba(0, 0, 0, 0.55)` | control, panel, list |
| `font` | `--sphere-theme-font` | `ui-sans-serif, system-ui, …` | same | overlay text |
| `mono` | `--sphere-theme-mono` | `ui-monospace, SFMono-Regular, …` | same | tags, paths, tooltip, `kbd` |
| `radius` | `--sphere-theme-radius` | `14px` | same | panel and shortcut list |
| `radius-sm` | `--sphere-theme-radius-sm` | `8px` | same | buttons, close/remove controls |
| `radius-input` | `--sphere-theme-radius-input` | `10px` | same | instruction box |

Rules:

- **MUST** treat `--sphere-theme-*` and the `theme` option as public API (semver). Adding a token
  **MUST** be documented here; renaming one is a breaking change.
- **MUST** keep the built-in palettes as fallbacks, not as overrides: setting `--sphere-theme-bg`
  on `<html>` **MUST** win over the built-in value.
- The tooltip is intentionally dark in both modes and is not part of the colour vocabulary; it is a
  transient label, not a surface (`docs/06-toolbar-ux.md` §6).
- `mode` affects only the built-in fallbacks. A token that is set — on the page or in the option —
  is used unchanged in every mode.

## 3. Precedence

From lowest to highest:

1. **Built-in defaults**, selected by `mode` (§5).
2. **Page CSS**: a declaration on an ancestor of the host (`html`, usually) is inherited into the
   host and wins over the built-in fallback. Example:

   ```css
   :root {
     --sphere-theme-bg: var(--cds-background);
     --sphere-theme-fg: var(--cds-text-primary);
   }
   ```

   This needs no plugin change and follows the page's theme classes live, because custom
   properties are inherited at computed-value time.

3. **The `theme` option**: values from `vite.config.ts` are written to the host's inline style, so
   they beat page CSS. They are also the only way to theme a project that does not expose variables
   on `<html>`.

Properties (`bg`, `fg`, …) are resolved inside the shadow root against the host's computed values;
`var()` chains therefore see the page's variables. This is the mechanism that lets
`bg: 'var(--cds-background)'` work while keeping `--cds-*` entirely outside Sphere.

The host is a child of `<html>` (`docs/06-toolbar-ux.md` §7), so variables declared on `<html>` or
`:root` are visible. Variables declared only on `<body>` are not; that is a deliberate constraint —
the host must stay out of a transformed or contained body subtree so `position: fixed` keeps
working. Use the option for those values.

## 4. The option

```ts
export interface SphereTheme {
  /** Which built-in palette the unmapped tokens use. Default: 'auto'. */
  mode?: 'auto' | 'light' | 'dark'
  /** Values for the public tokens. A value is any CSS value; `var(--…)` is allowed. */
  tokens?: Partial<Record<ThemeToken, string>>
}
```

```ts
// vite.config.ts
import { sphere } from 'sphere-plugin'

export default defineConfig({
  plugins: [
    sphere({
      theme: {
        tokens: {
          bg: 'var(--color-surface)',
          fg: 'var(--color-on-surface)',
          accent: 'var(--color-brand)',
          radius: '4px',
        },
      },
    }),
  ],
})
```

Validation (server start, `resolveOptions`):

- `theme` **MUST** be a plain object; unknown keys **MUST** throw.
- `mode` **MUST** be one of `auto`, `light`, `dark`; anything else **MUST** throw.
- `tokens` **MUST** be a plain object whose keys are in the vocabulary. An unknown token **MUST**
  throw a `TypeError` naming it (same posture as an unknown option).
- Each value **MUST** be a string, 1–200 characters, without control characters, and without
  `;`, `{`, `}`, `<`, `>`, `\`, `url(`, `@import` or `expression(`. The reason for each is in
  `docs/09-security-and-privacy.md` §5; the short version is: a value must not become a second
  declaration, a network request, an escape sequence or a style-sheet break-out.
- Values with `var()` are explicitly allowed: referencing the page's tokens is the feature. A
  `var()` chain resolves against the page's own declaration, so it can do whatever the page's CSS
  can do; Sphere validates the value it is given, not the page's stylesheet.

At runtime the overlay repeats the vocabulary and value check before calling `setProperty`, and
skips a value that fails. The plugin has already failed the server in that case; the runtime check
exists because the config module is one more file in the dev pipeline. A config module with no
`theme` at all (a dev server still running from an older version) falls back to the built-in
palette instead of preventing the overlay from mounting (`test/theme.test.ts`).

Transport: the resolved `{ mode, tokens }` travels in `virtual:sphere/config` with `root`, `base`
and `version` (`docs/07-delivery.md` §4). It never appears in the page's HTML or in a URL.

## 5. Mode

`mode` selects the built-in palette:

| Value | Built-in palette |
|---|---|
| `auto` (default) | `prefers-color-scheme` |
| `light` | light values, even on a dark OS |
| `dark` | dark values, even on a light OS |

It is applied as `data-sphere-mode="light"`/`"dark"` on the host (absent for `auto`), and the
shadow stylesheet selects the matching values. No restart, no re-mount, and nothing is added to the
page's own elements.

The overlay does **not** guess the app's theme from a class, an attribute or `color-scheme`. A
project that switches theme through `html.dark` gets a matching overlay by mapping its tokens
(§3.2) or by setting `mode` explicitly; both are deterministic, a guess is not. Mapping the app's
tokens is usually the better answer because their values switch with the class too.

## 6. Recipes

### Carbon

Carbon exposes its theme as `--cds-*` variables on the root. Map the surfaces; leave `picked` and
`hover` alone so pick marks stay recognisable:

```ts
sphere({
  theme: {
    tokens: {
      bg: 'var(--cds-background)',
      fg: 'var(--cds-text-primary)',
      muted: 'var(--cds-text-secondary)',
      border: 'var(--cds-border-subtle)',
      raised: 'var(--cds-layer-01)',
      accent: 'var(--cds-link-primary)',
      'on-accent': 'var(--cds-text-on-color)',
      danger: 'var(--cds-support-error)',
      radius: '0',
      'radius-sm': '0',
      'radius-input': '0',
    },
  },
})
```

Carbon's theme classes rewrite those variables on `<html>`, so the overlay follows the app's theme
without any further work.

### Tailwind

Tailwind v4 emits theme values as CSS variables on `:root`. Map your semantic names (the ones you
define with `@theme`), not the raw scale, or the overlay will follow the palette but not the
meaning:

```ts
sphere({
  theme: {
    tokens: {
      bg: 'var(--color-surface)',
      fg: 'var(--color-on-surface)',
      muted: 'var(--color-on-surface-muted)',
      border: 'var(--color-outline)',
      raised: 'var(--color-surface-raised)',
      accent: 'var(--color-primary)',
      'on-accent': 'var(--color-on-primary)',
    },
  },
})
```

Tailwind v3 compiles theme values into classes and has no runtime variables; use literal values
(or add the variables to your own `@theme`-equivalent layer). Do not import Tailwind's preflight
into the overlay — nothing in the overlay needs it, and it would change the tool's own layout.

### Page-level, no plugin change

A team that owns the app can put the mapping next to the rest of its tokens and leave
`vite.config.ts` alone:

```css
:root {
  --sphere-theme-font: var(--font-sans);
  --sphere-theme-radius: var(--radius-lg);
  --sphere-theme-bg: var(--surface);
  --sphere-theme-fg: var(--on-surface);
}
```

Because the variables inherit, this is also the way to make the overlay follow a theme switcher
that rewrites `:root` variables.

### Personal preference

No design system needed:

```ts
sphere({ theme: { mode: 'dark', tokens: { accent: '#ff5c8a', radius: '2px' } } })
```

## 7. What is deliberately excluded

- **No design-system CSS or components.** Importing Carbon/Tailwind into the overlay would make it
  depend on the host's version, inherit a reset, and let a page concern change the tool.
- **No auto-detection.** Sphere does not read `data-theme`, `.dark`, the computed
  `color-scheme`, or the body's computed styles. Those are guesses with a contrast failure as the
  failure mode.
- **No `theme.css` / stylesheet URL.** A blob of CSS could override layout, not just tokens, and
  could fetch remote resources. A missing token is added to this document and the vocabulary.
- **No class names.** Sphere never applies a design-system class to the overlay or to the app's
  DOM.
- **No new persistence.** Theme is configuration, not a UI preference: it is not stored in
  `localStorage` and does not appear in `docs/06-toolbar-ux.md` §10.

## 8. Tests

| Rule | Test |
|---|---|
| Defaults when no theme is configured | `test/theme.test.ts` — `resolveOptions` |
| Unknown option/token/mode named in the error | `test/theme.test.ts` |
| Unsafe values rejected (each forbidden form) | `test/theme.test.ts` |
| `var()` values accepted | `test/theme.test.ts` |
| Resolved theme travels in `virtual:sphere/config` | `test/theme.test.ts` — plugin `load` |
| Runtime applies known tokens and drops unknown/bad ones | `test/theme.test.ts` — `applyTheme` |
| Page `--sphere-theme-*` is inherited into the shadow root | `e2e/theme.mjs` |
| Option tokens beat page CSS (inline wins) | `e2e/theme.mjs` |
| `mode: 'light'`/`'dark'` overrides the OS preference | `e2e/theme.mjs` |
| No `url()` can reach the network | `test/theme.test.ts` (validation) + `docs/09` §5 |

The e2e case runs `fixtures/plain` with a second config file that sets a theme, then injects page
CSS at runtime; it only asserts computed values inside the shadow root. Screenshots in
`docs/images/` are generated with the default theme and must not change.

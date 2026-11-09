# 0012 — Design-system integration is a token contract, not an adapter

## Context

The overlay ships a fixed palette (`docs/06-toolbar-ux.md` §6). Two kinds of users want it to look
different:

- **Site teams** whose app already has a design system, and who want the tool to look like the
  thing they are inspecting.
- **Individuals** who want their own colours, radius or font, independent of the site.

The obvious implementation — import Tailwind, Carbon, or the app's stylesheet — is the wrong one.
It would add a runtime and CSS dependency to a dev-only tool, make the overlay inherit a reset or a
preflight that changes its own layout, and give a framework the power to change the page through
the tool. The overlay is a guest; its styles must remain the only ones it applies.

The shadow root already gives isolation, and one thing still crosses that boundary: **CSS custom
properties inherit**. That is the narrowest possible bridge: a value, not a stylesheet; no classes,
no components, no runtime.

## Decision

1. **The integration surface is a fixed token vocabulary.** The overlay reads a small set of
   semantic values from custom properties named `--sphere-theme-*` (the table lives in
   `docs/13-theming.md` §2). Each has a built-in fallback, so a project that never touches them
   looks exactly as it does today.
2. **Three precedence tiers**, in this order: built-in defaults, then page CSS inherited into the
   host (`<html>` or a stylesheet on an ancestor), then `sphere({ theme: { tokens } })`. Plugin
   tokens are applied with `CSSStyleDeclaration.setProperty` on the host, so they win as inline
   style, and the browser — not Sphere — parses the value.
3. **Reusing a design system means mapping its tokens**: `bg: 'var(--cds-background)'`, not
   `import '@carbon/styles'`. Tailwind, Carbon and friends stay the user's dependency; Sphere only
   reads values that are already computed in the page.
4. **`theme.mode` chooses which built-in set the unmapped tokens use**: `auto` follows
   `prefers-color-scheme`, `light` and `dark` force a set. It is an attribute on the host
   (`data-sphere-mode`), so it changes nothing in the page and needs no re-mount.
5. **No automatic harvesting.** Sphere never copies computed colours, fonts or spacing from the
   page. A mapping is explicit, reviewable, and does not turn a design bug into a tool bug.
6. **No arbitrary CSS escape hatch.** There is no `theme.css` option. A stylesheet would undo the
   isolation promise and the audit surface; a token that the vocabulary lacks is a new token with
   an ADR, not a blob of CSS in a config file.
7. **Values are validated twice.** At server start the plugin rejects an unknown token, a
   non-string or an unsafe value with a message naming it (dev-time, so failing loudly is cheap);
   at runtime the overlay drops anything that does not fit the contract before touching the
   host. Token names are applied through the CSSOM, never concatenated into a `<style>` element.

`theme` travels in `virtual:sphere/config`, next to `root`, `base` and `version`
(`docs/07-delivery.md` §4), and is part of the plugin option surface (`docs/02-architecture.md`).

## Consequences

- Zero dependency: no design-system package, CSS import, build step or class name enters Sphere.
  Tailwind v4 and Carbon work because both expose CSS variables; Tailwind v3 (no runtime variables)
  uses literal values or the project's own variables.
- Theme changes are live: custom properties inherit continuously, so switching the app's theme
  class updates the overlay on the next paint. Forcing `mode` only changes unmapped defaults.
- The public API is `--sphere-theme-*` plus the `theme` option; both are semver-bound. The internal
  `--sphere-*` variables stay private and may change.
- A design system's **components** are not available to the overlay. That is the point: matching a
  look does not require adopting a component runtime, and a tool that looks 90 % like the app is
  better than one that drags the app's stack into dev tooling.
- A CSS value that the browser cannot parse is dropped at runtime; the overlay keeps its default
  instead of breaking. The plugin validation catches the mistakes a value can be checked for
  without a CSS parser. A `var()` reference is resolved by the page: Sphere validates the mapping
  it is given, not what the page's variable contains.
- The token vocabulary is deliberately small. New needs (density, motion, z-index) are decisions,
  not free-form configuration.

## Alternatives considered

- **Import the design system's CSS / components**: real fidelity, but a hard dependency, a reset
  that fights the overlay's own layout, CSP and weight costs, and a coupling that breaks when the
  user upgrades the framework.
- **Copy computed styles from the page at mount**: zero config, but nondeterministic (whatever
  element is chosen), produces contrast failures, reads app styling Sphere does not otherwise
  touch, and does not follow a live theme switch.
- **A `theme.css` string or stylesheet URL**: maximal flexibility, but it lets a config file
  restyle the tool arbitrarily, defeats the "shadow root is the only surface" audit, and invites
  network loads (`url()`, `@import`) into a tool that promises none.
- **Code presets (`import { carbon } from 'sphere-plugin/theme'`)**: convenient, but implies
  support for a version of someone else's token names. Recipes in the docs can be corrected
  without a release; presets cannot.

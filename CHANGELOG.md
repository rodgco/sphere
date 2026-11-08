# sphere-plugin

## 0.1.0

### Minor Changes

- First release: pick an element in a running Svelte app and copy a markdown prompt with its
  verified source location, template context, component chain, props, live state and a numbered
  source window. Dev-only (`apply: 'serve'`), clipboard only, and inert with
  `sphere({ enabled: false })`.

  The prompt format is documented as unstable until 1.0 (`docs/05-prompt-format.md`), so a minor
  release may change the clipboard document.

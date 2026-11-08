# sphere-plugin

## 0.1.0

### Minor Changes

- First release: pick an element in a running Svelte app and copy a markdown prompt with its
  verified source location, template context, component chain, props, live state and a numbered
  source window. Dev-only (`apply: 'serve'`), clipboard only, and inert with
  `sphere({ enabled: false })`.

- Keyboard selection while picking: `w`/`s`/`a`/`d` and the arrows walk parent, first child and
  siblings from the moment picking starts — before anything is picked — `Enter`/`Space` picks the
  outlined element, `Backspace` removes the last pick, `c` copies. A navigation key locks the
  outline, so a click confirms the outlined element instead of whatever is under the pointer. It is
  the answer to a container that covers its children and can never be clicked.

  The prompt format is documented as unstable until 1.0 (`docs/05-prompt-format.md`), so a minor
  release may change the clipboard document.

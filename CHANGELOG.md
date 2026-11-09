# sphere-plugin

## 0.2.0

### Minor Changes

- Security and correctness pass from the audit: redact form values, URL credentials/query strings and sensitive/PII props and state, stop emitting the page title, escape prompt fences and one-line fields, make the 60 000-character cap hard, keep the generated client seam callable when instrumentation degrades, remove the `/tmp` debug write and the page-global inspection API, handle POSIX/Windows paths and source URLs, invalidate the source cache on HMR, require identity before verifying a location, and clean up overlay storage, drag and copy handling. Adds `sphere({ instrumentation: false })` and removes `window.__SPHERE__`.

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
  the answer to a container that covers its children and can never be clicked. `?` shows the
  shortcut list (also in the panel header), `p` pins the outline so a click can confirm it after the
  pointer travels, and `Shift+Enter` picks and stops. `Escape` closes the list before the panel
  before leaving picking.

  The prompt format is documented as unstable until 1.0 (`docs/05-prompt-format.md`), so a minor
  release may change the clipboard document.

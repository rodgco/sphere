# sphere-plugin

## 0.3.1

### Patch Changes

- 359b0e7: Keep the prompt panel attached to the control. It used to be placed once, when it opened, from an
  estimated height: the panel then floated away from the pill (a visible hole where the estimate was
  too large) and stayed behind when the pill was dragged. The panel is now pinned by the edge facing
  the control (`bottom` when above, `top` when below), so a short panel keeps exactly the 10 px gap,
  and its placement is derived from the control's live box, so it travels with a drag and re-chooses
  its side as the pill approaches an edge. The panel width, height cap and 18 px viewport margin now
  come from the same constants as the overlay's CSS (`docs/06-toolbar-ux.md` §4).
- e9a11aa: Stop painting a focus ring around the prompt panel. Chromium reports `:focus-visible` for the
  programmatic `focus()` that follows a pick, so the whole dialog wore a 2 px accent outline on every
  pick. The dialog takes focus only to be announced, so it paints none now, while its buttons and
  fields keep theirs for keyboard use.
- 06398a9: Resolve Svelte's reported file names from the dev server's working directory. Svelte reports
  `__svelte_meta.loc.file` relative to where the server was started — not to Vite's `root` — so any
  setup where the two differ (a monorepo, `vite --config apps/web/vite.config.ts`, or the repo's own
  `npm run dev` / `npm run lab`) asked `/@fs` for a doubled path and answered a 500 on the first
  pick, which meant no source window and an unverified location. `virtual:sphere/config` now carries
  `cwd` next to `root`: a relative name is resolved against `cwd` for the read, and the absolute
  result is relativised against `root` for the panel chip and the prompt, so the path stays
  `src/App.svelte` instead of growing a working-directory prefix.

## 0.3.0

### Minor Changes

- 4dd08b6: Add a design-system bridge (`docs/13-theming.md`). The overlay now reads a small public token
  vocabulary from `--sphere-theme-*` custom properties with built-in fallbacks, so a project can map
  Carbon, Tailwind or its own variables into the tool without importing a framework, its CSS or its
  components. `sphere({ theme: { tokens } })` applies the same mapping from `vite.config.ts` (inline
  style on the host, so it wins over page CSS), and `theme.mode` (`auto`/`light`/`dark`) chooses the
  built-in palette. Values are validated at server start and again before they reach the page; the
  default look is unchanged when no theme is configured. Decision:
  `docs/decisions/0012-design-system-tokens.md`.

## 0.2.1

### Patch Changes

- Refresh the published README for the trimmed install/use/contribute guide, and update the CI action runtimes to Node 24.

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

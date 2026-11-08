# Licensing and attribution

## The projects involved

| Project | License | What Sphere takes |
|---|---|---|
| `vite-devtools-svelte` (baseballyama) | MIT | ideas, and (optionally) code that we wrote on top of it in a private fork |
| `svelte` | MIT | nothing copied; behaviour of `svelte/internal/client` is documented, not vendored |
| `vite` | MIT | nothing copied |
| `@sveltejs/vite-plugin-svelte` | MIT | the *pattern* of serving overlay sources as virtual modules (and the injected-client TODO we plan to improve) |

## What counts as what

- **Ideas and facts are not licensed.** “Wrap `svelte/internal/client` and stamp elements” is an
  approach; the notes in `docs/learning/` are our own description of observed behaviour.
- **Code is.** If Sphere copies or adapts source from `vite-devtools-svelte` (including our own
  additions inside a fork of it — that repository is MIT and its distribution is governed by that
  license), the MIT notice must travel with it.
- **Our additions to the fork** (`wrapper-toolbar.js`, `prompt-format.ts`, `prompt-toolbar.js`, the
  tests, the e2e and screenshot scripts) were written by the author of this project, so
  relicensing/reusing them here is the author's call; keeping the upstream MIT notice is still the
  honest thing when a file is a derivative of an upstream file (for example `wrapper.js`).

## Rule for this repository

1. Every file that is copied or adapted from another project carries a header:

   ```
   Adapted from vite-devtools-svelte (MIT) — https://github.com/baseballyama/vite-devtools-svelte
   Original: <file path in that project>; changes: <one line>.
   ```

2. `THIRD_PARTY.md` at the repository root lists every source of adapted code with its license
   text, updated in the same commit as the adaptation.
3. Files written from scratch (the overlay components, the delivery layer, the docs) carry no
   third-party header.
4. No code from projects without a permissive license (GPL, unknown, “source available”) may enter
   this repository, not even “small snippets”.
5. Documentation may quote behaviour and identifier names; it must not paste large code blocks from
   upstream. Short, attributed excerpts (a few lines, with the path and version) are acceptable for
   the notes in `docs/learning/`.

## `THIRD_PARTY.md` template (to create at M0, if any code is adapted)

```md
# Third-party code

## vite-devtools-svelte

MIT License — Copyright (c) Yuichiro Yamashita
https://github.com/baseballyama/vite-devtools-svelte

Adapted files:
- src/runtime/instrumentation/elements.ts ← src/runtime/wrapper-toolbar.js (element stamps)
- src/runtime/format.ts ← src/runtime/prompt-format.ts (location resolution, formatting)

<full MIT text>
```

# Contributing conventions (Sphere)

Sphere is spec-first. Read `README.md` and the doc that covers your change before writing
code; when behaviour and docs disagree, the docs are the bug to fix first (or the behaviour,
in the same change).

## Docs

- One topic per file under `docs/`; keep the numbering, add new files at the end.
- Decisions go to `docs/decisions/NNNN-title.md` (MADR-lite: Context, Decision, Consequences,
  Alternatives). Do not rewrite an accepted decision; supersede it.
- Facts about Svelte/SvelteKit/Vite belong to `docs/learning/` and are expected to cite the
  file and function they come from (`svelte/src/internal/client/...`) with the version.
- Specs state behaviour as rules ("MUST/MUST NOT/SHOULD") plus the test that proves it.
- No screenshots are pasted into docs unless the capture script produced them.

## Code (from M0 on)

- TypeScript strict, ESM only, Node >= 22.
- Pure logic lives in `.ts` modules and is unit-tested; browser-only layers are thin.
- The overlay may be written in Svelte and compiled by the host project's plugin — no
  bundling step for it in this repo.
- Nothing in the repository may log the user's source or state to the terminal or a file.
- Every dev-facing surface is opt-in and inert when the option is off.

## Commits

- Conventional commits, one intent per commit, tests in the same commit as the behaviour.
- A change that alters the clipboard format must update `docs/05-prompt-format.md`,
  `docs/specs/clipboard-example.md` and the golden test.

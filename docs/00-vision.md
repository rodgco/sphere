# 00 — Vision

## The problem

An agent can edit a Svelte component precisely **if** it is told which file, which element,
which template branch, and what the current values are. Getting there by hand is slow and
lossy: you copy a path, hunt the line, paste a screenshot, describe the state in prose, and
the agent still guesses which of three `<button>`s you meant.

Meanwhile the information exists exactly once, in the browser, at the moment you are looking
at the broken thing — Svelte's dev metadata knows where every element is declared, and the
runtime knows every component instance, its props and its live state.

Sphere is the shortest path between "this element here, like this" and a prompt that an agent
can act on without asking a follow-up question.

## Who it is for

- **Developers using a coding agent on a Svelte app** (Claude Code, Codex, Cursor, Pi…), who
  lose time describing UI in prose or pasting screenshots.
- **People reviewing or debugging someone else's Svelte code**, who need to find the file
  behind a widget fast.
- **Teams pairing with an agent on design tweaks**, where the instruction is short but the
  context ("this button, in this list, while the filter is open") is long.

Not for: end users, production, CI, or anyone who does not run the dev server.

## The insight

Three properties of the Svelte dev mode make this cheap:

1. Every element the compiler emits carries its source location (`__svelte_meta.loc`), and
   the enclosing component tags and blocks are recorded in a dev stack
   (`__svelte_meta.parent`).
2. The component runtime is observable from the client module boundary
   (`svelte/internal/client`): mount/unmount order, signal names, block ownership.
3. Both are *dev-only* and already paid for by anyone running `vite dev`.

So the tool is small: read the metadata, follow the instance tree, bound the values, format
markdown, put it on the clipboard.

## What makes it different from an inspector

An inspector answers **"where is this?"** and stops. Sphere answers **"what should change,
here, in this state?"**:

| Inspector (`vite-plugin-svelte`'s, DevTools panels) | Sphere |
|---|---|
| Hover → file:line → open editor | Pick → keep a list of selections → describe → copy |
| One element at a time, ephemeral | Several elements, numbered, kept while you write |
| State shown in a UI you read | State written into the prompt you paste |
| Optimised for human eyes | Optimised for a model: bounded, labelled, unambiguous |
| Ends in your editor | Ends in your agent |

They compose: Sphere is not trying to replace the inspector, and a user can run both.

## Product shape (v1)

- One npm package, one Vite plugin, opt-in through the Svelte/Vite config.
- A floating control in your app (draggable, no global shortcut), a picking mode, a panel
  with the selections list, an instruction box, and **Copy prompt**.
- A markdown document on the clipboard. No network, no accounts, no storage of your code.

## Non-goals for v1

- Applying changes, running tools, or talking to a model itself.
- Reading or writing files outside the project root.
- Persisting anything about the app (only UI preferences live in `localStorage`).
- Frameworks other than Svelte 5 / SvelteKit.
- Being present in production builds, previews or test runs.

## Success looks like

- "Pick the button, type one sentence, paste" takes under 15 seconds.
- In a fresh SvelteKit app the reported `file:line` is correct for ≥ 95 % of picked elements,
  and the remaining cases are labelled as approximate instead of being wrong.
- A prompt for three elements stays under ~10 KB and contains no machine paths.
- Turning the feature off leaves the served client module byte-identical to upstream.

## Naming

`sphere` (the sphere of context around a piece of UI). Package naming is an open decision —
see `docs/decisions/0001-independent-project.md`.

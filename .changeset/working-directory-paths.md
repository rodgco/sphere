---
'sphere-plugin': patch
---

Resolve Svelte's reported file names from the dev server's working directory. Svelte reports
`__svelte_meta.loc.file` relative to where the server was started — not to Vite's `root` — so any
setup where the two differ (a monorepo, `vite --config apps/web/vite.config.ts`, or the repo's own
`npm run dev` / `npm run lab`) asked `/@fs` for a doubled path and answered a 500 on the first
pick, which meant no source window and an unverified location. `virtual:sphere/config` now carries
`cwd` next to `root`: a relative name is resolved against `cwd` for the read, and the absolute
result is relativised against `root` for the panel chip and the prompt, so the path stays
`src/App.svelte` instead of growing a working-directory prefix.

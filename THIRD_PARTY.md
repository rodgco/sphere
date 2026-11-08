# Third-party code

Sphere includes **no third-party code**. Every module in `src/`, every script in `scripts/` and
every test in this repository was written for it.

What it does depend on at runtime is what the user's project already has: `svelte` and `vite` are
peer dependencies, and the browser half is compiled by the host's own Svelte plugin. Those
packages are consumed, never vendored.

What it learned from is public: Svelte's own source, Vite's source and documentation, and the
`@sveltejs/kit` and `vite-plugin-svelte` packages, read to understand documented and undocumented
behaviour. Those findings live in `docs/learning/`, with the file and function they came from, and
are descriptions rather than copied code.

If that ever changes — if a file is adapted from another project — it will carry the original
license header, the full license text will move into this file, and the change will say so.

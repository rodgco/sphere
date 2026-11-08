import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { harnessWrapper } from './test/harness/plugin.ts'
import setup from './test/harness/setup.ts'

/**
 * The runtime harness: real compiled fixtures, the generated wrapper as the client module, a
 * DOM — but no browser. This is the layer that can prove *what the wrapper sees*; anything
 * about hydration or event handling belongs to the Playwright suite (M2).
 *
 * Two facts make this work with Vitest 5, both verified in
 * `docs/learning/vitest-svelte-harness.md`:
 * - Vitest transforms test modules in a `client` environment (`ssr: false`), so `.svelte`
 *   files are compiled for the browser and `mount()` works without a browser.
 * - `resolve.conditions: ['browser']` makes `svelte` resolve to `src/index-client.js`;
 *   without it, `mount()` comes from the server build and throws
 *   `lifecycle_function_unavailable`.
 *
 * The wrapper is written to `test/harness/generated/` by the global setup and reached through
 * `test/harness/plugin.ts` (see the comment there for why it is not a `\0`-id here).
 */
export default defineConfig({
  plugins: [harnessWrapper(), svelte({ configFile: false, compilerOptions: { dev: true } })],
  resolve: { conditions: ['browser'] },
  test: {
    globalSetup: ['./test/harness/setup.ts'],
    setupFiles: ['./test/harness/setup-files.ts'],
    include: ['test/harness/**/*.test.ts'],
    environment: 'happy-dom',
    testTimeout: 20_000,
  },
})

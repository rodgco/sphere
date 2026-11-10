import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { sphere } from '../../src/plugin/index.ts'

/**
 * The theme e2e config (`e2e/theme.mjs`). Kept apart from `vite.config.ts` so the default-look
 * screenshots and the other e2e cases keep running against an unthemed overlay.
 *
 * `accent` and `border` are literals so the test can tell the option's inline value from the page
 * variable; `font` proves a token that is not a colour; `mode: 'light'` proves the forced palette
 * against a dark OS.
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    sphere({
      theme: {
        mode: 'light',
        tokens: {
          accent: 'rgb(1, 2, 3)',
          border: 'rgb(4, 5, 6)',
          font: 'monospace',
        },
      },
    }),
    svelte(),
  ],
})

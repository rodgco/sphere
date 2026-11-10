import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { sphere } from '../../src/plugin/index.ts'

/**
 * The visual lab (`npm run lab`): a page built to see the panel's geometry, and nothing else.
 *
 * The overlay is dev-only, so the lab is a normal dev server with the plugin in the array. The
 * page fills the viewport with pickable tiles and draws the 18 px margin, so the three rules of
 * `docs/06-toolbar-ux.md` §4 are visible at a glance: the 10 px gap to the pill, the side chosen
 * from the room available, and the panel inside the margin on every edge.
 */
export default defineConfig({
  plugins: [sphere(), svelte()],
  server: { port: 5202, strictPort: true },
})

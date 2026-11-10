import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { sphere } from '../../src/plugin/index.ts'

export default defineConfig({
  // Vite's `root` defaults to the working directory, and `npm run dev` is started from the
  // repository root; without this the fixture would be served from the wrong directory (`/` 404s).
  root: import.meta.dirname,
  // Sphere goes before the Svelte plugin: it must resolve its ids first.
  plugins: [sphere(), svelte()],
  server: { port: 5201, strictPort: true },
})

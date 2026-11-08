import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { sphere } from '../../src/plugin/index.ts'

export default defineConfig({
  // Sphere goes before the Svelte plugin: it must resolve its ids first.
  plugins: [sphere(), svelte()],
  server: { port: 5201, strictPort: true },
})

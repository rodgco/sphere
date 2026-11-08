import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { sphere } from 'sphere-plugin'

export default defineConfig({
  // Sphere first: it must resolve its ids before the Kit plugin compiles imports.
  plugins: [sphere(), sveltekit()],
  server: {
    // This fixture links the package from the repository root, so the served runtime lives
    // outside the fixture directory. A real install has it under node_modules.
    fs: { allow: ['../..'] },
  },
})

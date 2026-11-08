import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', '!test/harness/**'],
    environment: 'node',
    // The delivery test boots real Vite dev servers.
    testTimeout: 30_000,
  },
})

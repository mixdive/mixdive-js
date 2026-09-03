import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// One test run for the whole workspace. The React package is tested against
// the browser package's *source*, so a test failure never hides behind a
// stale dist build.
export default defineConfig({
  define: { __MIXDIVE_VERSION__: JSON.stringify('test') },
  resolve: {
    alias: {
      '@mixdive/browser': fileURLToPath(new URL('./packages/browser/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
})
